import { watch } from 'chokidar';
import type { Metadata, Plugin, Service } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { Logger } from 'pino';
import {
  CancellationToken,
  DisposableStore,
  Emitter,
  ThrottledDelayer,
  toDisposable,
} from 'ts-primitives';
import { createRequire } from '../../createRequire';
import type { NostalgieSettings } from '../../settings';
import { codeImportsPlugin } from '../esbuildPlugins/codeImportsPlugin';
import { cssBrowserPlugin } from '../esbuildPlugins/cssPlugin';
import { decorateDeferredImportsBrowserPlugin } from '../esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { mdxPlugin } from '../esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from '../esbuildPlugins/reactShimPlugin';
import { serverFunctionProxyPlugin } from '../esbuildPlugins/serverFunctionProxyPlugin';
import { svgPlugin } from '../esbuildPlugins/svgPlugin';
import { ClientBuildMetadata } from '../metadata';
import type { ServerFunctionBuildResult, ServerFunctionsBuilder } from './functions';

export interface ClientAssetBuildResult {
  meta: ClientBuildMetadata;
}

export interface ClientAssetBuilderOptions {
  functionsBuilder: ServerFunctionsBuilder;
  logger: Logger;
  service: Service;
  settings: NostalgieSettings;
  throttleInterval?: number;
  token: CancellationToken;
}

export class ClientAssetBuilder {
  private readonly delayer: ThrottledDelayer<unknown>;
  private readonly disposer = new DisposableStore();
  private readonly functionsBuilder: ServerFunctionsBuilder;
  private lastServerFunctionBuildResult?: ServerFunctionBuildResult;
  private readonly logger: Logger;
  private readonly onBuildEmitter = new Emitter<ClientAssetBuildResult>();
  private readonly onBuildErrorEmitter = new Emitter<Error>();
  private readonly service: Service;
  private readonly settings: NostalgieSettings;
  private readonly token: CancellationToken;
  private readonly watcher = watch([], { ignoreInitial: true, usePolling: true, interval: 16 });
  private readonly watchedFiles = new Set<string>();

  constructor(options: ClientAssetBuilderOptions) {
    this.delayer = new ThrottledDelayer(options.throttleInterval ?? 0);

    this.disposer.add(this.delayer);
    this.disposer.add(this.onBuildEmitter);
    this.disposer.add(toDisposable(() => this.watcher.close()));

    this.functionsBuilder = options.functionsBuilder;
    this.logger = options.logger;
    this.service = options.service;
    this.settings = options.settings;
    this.token = options.token;
  }

  get onBuild() {
    return this.onBuildEmitter.event;
  }

  get onBuildError() {
    return this.onBuildErrorEmitter.event;
  }

  async build(functionsBuildResult: ServerFunctionBuildResult) {
    const start = Date.now();

    this.logger.debug('Starting client asset build');

    try {
      this.lastServerFunctionBuildResult = functionsBuildResult;

      const staticDir = this.settings.staticDir;
      const clientMetaPath = Path.resolve(staticDir, './clientMetadata.json');
      const runtimeRequire = createRequire(Path.resolve(this.settings.buildDir, './index.js'));
      const appRequire = createRequire(this.settings.applicationEntryPoint);
      const nostalgieBootstrapPath = runtimeRequire.resolve('nostalgie/internal/bootstrap');
      const resolveExtensions = [...this.settings.resolveExtensions];
      const relativeAppEntry = `./${Path.relative(
        this.settings.rootDir,
        this.settings.applicationEntryPoint
      )}`;
      const cssMap = new Map<string, string>();

      const plugins: Plugin[] = [
        codeImportsPlugin({ settings: this.settings }),
        mdxPlugin({ token: this.token }),
        svgPlugin(),
        cssBrowserPlugin(this.settings, this.service, cssMap),
        reactShimPlugin(this.settings),
        decorateDeferredImportsBrowserPlugin({
          rootDir: this.settings.rootDir,
        }),
      ];

      if (this.settings.functionsEntryPoint) {
        plugins.push(
          serverFunctionProxyPlugin(
            this.settings.functionsEntryPoint,
            functionsBuildResult.functionNames
          )
        );
      }

      await this.service.build({
        bundle: true,
        define: {
          'process.env.NODE_ENV': JSON.stringify(this.settings.buildEnvironment),
          'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('browser'),
          'process.env.NOSTALGIE_RPC_PATH': JSON.stringify('/.nostalgie/rpc'),
          'process.env.NOSTALGIE_PUBLIC_URL': '"/"',
        },
        logLevel: 'error',
        assetNames: 'assets/[name]-[hash]',
        chunkNames: 'chunks/[name]-[hash]',
        external: [],
        format: 'esm',
        incremental: true,
        inject: [appRequire.resolve('nostalgie/internal/inject-react')],
        loader: this.settings.loaders,
        metafile: clientMetaPath,
        minify: this.settings.buildEnvironment === 'production',
        outbase: Path.dirname(this.settings.applicationEntryPoint),
        outdir: Path.resolve(staticDir, './build'),
        platform: 'browser',
        plugins,
        publicPath: '/static/build/',
        resolveExtensions,
        mainFields: ['module', 'browser', 'main'],
        sourcemap: true,
        splitting: true,
        stdin: {
          contents: `
        import { hydrateNostalgie } from ${JSON.stringify(nostalgieBootstrapPath)};
        import App from ${JSON.stringify(relativeAppEntry)}
        
        export function start(options) {
          return hydrateNostalgie(App, options);
        }
              `,
          loader: 'js',
          resolveDir: this.settings.rootDir,
          sourcefile: Path.resolve(this.settings.applicationEntryPoint, '../bootstrap.js'),
        },
        treeShaking: true,
      });

      const metaFileContents = await Fs.readFile(clientMetaPath, 'utf8');

      // The metadata has potentially sensitive info like local paths
      await Fs.unlink(clientMetaPath);

      const meta: Metadata = JSON.parse(metaFileContents);

      const newInputFiles = new Set(
        Object.keys(meta.inputs).map((fileName) => Path.join(this.settings.rootDir, fileName))
      );

      // Remove files no longer needed
      for (const pathName of this.watchedFiles) {
        if (!newInputFiles.has(pathName)) {
          this.logger.trace({ build: 'client', pathName }, 'stopped watching file');
          this.watcher.unwatch(pathName);
          this.watchedFiles.delete(pathName);
        }
      }

      // Add new files
      for (const pathName of newInputFiles) {
        if (!this.watchedFiles.has(pathName)) {
          this.logger.trace({ build: 'client', pathName }, 'started watching file');
          this.watcher.add(pathName);
          this.watchedFiles.add(pathName);
        }
      }

      this.logger.info({ latency: Date.now() - start }, 'Finished client asset build');

      this.onBuildEmitter.fire({ meta: new ClientBuildMetadata(this.settings, meta, cssMap) });
    } catch (err) {
      this.logger.info({ err, latency: Date.now() - start }, 'Error building client assets');

      this.onBuildErrorEmitter.fire(err);
    }
  }

  dispose() {
    return this.disposer.dispose();
  }

  start() {
    this.functionsBuilder.onBuild((result) => {
      this.delayer.trigger(() => {
        return this.build(result);
      });
    });
    this.watcher.on('all', () => {
      this.delayer.trigger(async () => {
        if (this.lastServerFunctionBuildResult) {
          return this.build(this.lastServerFunctionBuildResult);
        }
      });
    });
  }
}
