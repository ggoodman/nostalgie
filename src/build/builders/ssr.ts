import { watch } from 'chokidar';
import type { Metadata, Service } from 'esbuild';
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
import { decorateDeferredImportsServerPlugin } from '../esbuildPlugins/decorateDeferredImportsServerPlugin';
import { mdxPlugin } from '../esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from '../esbuildPlugins/reactShimPlugin';
import { svgPlugin } from '../esbuildPlugins/svgPlugin';
import type { ClientAssetBuilder, ClientAssetBuildResult } from './client';

export interface ServerRendererBuildResult {
  // cssMap: Map<string, string>;
  // meta: Metadata;
}

export interface ServerRendererBuilderOptions {
  clientAssetBuilder: ClientAssetBuilder;
  logger: Logger;
  service: Service;
  settings: NostalgieSettings;
  throttleInterval?: number;
  token: CancellationToken;
}

export class ServerRendererBuilder {
  private readonly delayer: ThrottledDelayer<unknown>;
  private readonly disposer = new DisposableStore();
  private readonly clientAssetBuilder: ClientAssetBuilder;
  private lastClientAssetBuildResult?: ClientAssetBuildResult;
  private readonly logger: Logger;
  private readonly onBuildEmitter = new Emitter<ServerRendererBuildResult>();
  private readonly service: Service;
  private readonly settings: NostalgieSettings;
  private readonly token: CancellationToken;
  private readonly watcher = watch([], { ignoreInitial: true });
  private readonly watchedFiles = new Set<string>();

  constructor(options: ServerRendererBuilderOptions) {
    this.delayer = new ThrottledDelayer(options.throttleInterval ?? 0);

    this.disposer.add(this.delayer);
    this.disposer.add(this.onBuildEmitter);
    this.disposer.add(toDisposable(() => this.watcher.close()));

    this.clientAssetBuilder = options.clientAssetBuilder;
    this.logger = options.logger;
    this.service = options.service;
    this.settings = options.settings;
    this.token = options.token;
  }

  get onBuild() {
    return this.onBuildEmitter.event;
  }

  async build(clientBuildResult: ClientAssetBuildResult) {
    const start = Date.now();
    this.logger.debug('Starting server renderer build');

    const buildDir = this.settings.buildDir;
    const metaPath = Path.resolve(buildDir, './serverRendererMetadata.json');
    const nostalgieRequire = createRequire(__filename);
    const appRequire = createRequire(this.settings.applicationEntryPoint);
    const nostalgieServerPath = appRequire.resolve('nostalgie/internal/server');
    const resolveExtensions = [...this.settings.resolveExtensions];
    const relativeAppEntry = `./${Path.relative(
      this.settings.rootDir,
      this.settings.applicationEntryPoint
    )}`;

    const serverFunctionsImport = this.settings.functionsEntryPoint
      ? `import * as Functions from ${JSON.stringify(
          `./${Path.relative(this.settings.rootDir, this.settings.functionsEntryPoint)}`
        )}`
      : 'const Functions = {};';

    await this.service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(this.settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      format: 'cjs',
      inject: [appRequire.resolve('nostalgie/internal/node-browser-apis')],
      loader: this.settings.loaders,
      logLevel: 'error',
      metafile: metaPath,
      minify: this.settings.buildEnvironment === 'production',
      outbase: Path.dirname(this.settings.applicationEntryPoint),
      outfile: Path.resolve(this.settings.buildDir, 'ssr.js'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [
        mdxPlugin({ token: this.token }),
        svgPlugin(),
        reactShimPlugin(this.settings),
        decorateDeferredImportsServerPlugin({
          relativePath: this.settings.applicationEntryPoint,
          buildDir,
          clientBuildMetadata: clientBuildResult.meta,
          logger: this.logger,
          resolveExtensions,
          rootDir: this.settings.rootDir,
        }),
      ],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: `
import { ServerRenderer } from ${JSON.stringify(nostalgieServerPath)};
import { worker } from ${JSON.stringify(nostalgieRequire.resolve('workerpool'))};
import App from ${JSON.stringify(relativeAppEntry)};
${serverFunctionsImport}

const renderer = new ServerRenderer(App, Functions, ${JSON.stringify(
          clientBuildResult.meta.getChunkDependenciesObject()
        )});

worker({
  invokeFunction: renderer.invokeFunction.bind(renderer),
  renderAppOnServer: renderer.renderAppOnServer.bind(renderer),
});
        `,
        loader: 'js',
        resolveDir: this.settings.rootDir,
        sourcefile: Path.resolve(this.settings.applicationEntryPoint, '../worker.js'),
      },
      target: ['node12'],
      treeShaking: true,
      write: true,
    });

    const metaFileContents = await Fs.readFile(metaPath, 'utf8');

    // The metadata has potentially sensitive info like local paths
    // await Fs.unlink(clientMetaPath);

    const meta: Metadata = JSON.parse(metaFileContents);

    const newInputFiles = new Set(Object.keys(meta.inputs));

    // Remove files no longer needed
    for (const fileName of this.watchedFiles) {
      if (!newInputFiles.has(fileName)) {
        this.watcher.unwatch(fileName);
        this.watchedFiles.delete(fileName);
      }
    }

    // Add new files
    for (const fileName of newInputFiles) {
      if (!this.watchedFiles.has(fileName)) {
        this.watcher.add(fileName);
        this.watchedFiles.add(fileName);
      }
    }

    this.logger.info({ latency: Date.now() - start }, 'Finished server renderer build');

    this.onBuildEmitter.fire({});
  }

  dispose() {
    return this.disposer.dispose();
  }

  start() {
    this.clientAssetBuilder.onBuild((result) => this.build(result));
    this.watcher.on('all', () => {
      if (this.lastClientAssetBuildResult) {
        this.build(this.lastClientAssetBuildResult);
      }
    });
  }
}
