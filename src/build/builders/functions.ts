import { watch } from 'chokidar';
import type { Metadata, Service } from 'esbuild';
import * as Path from 'path';
import type { Logger } from 'pino';
import { DisposableStore, Emitter, ThrottledDelayer, toDisposable } from 'ts-primitives';
import type { NostalgieSettings } from '../../settings';

export interface ServerFunctionBuildResult {
  functionNames: string[];
  serverFunctionsEntry: string | null;
}

export interface ServerFunctionBuilderOptions {
  logger: Logger;
  service: Service;
  settings: NostalgieSettings;
  throttleInterval?: number;
}

export class ServerFunctionsBuilder {
  private readonly delayer: ThrottledDelayer<unknown>;
  private readonly disposer = new DisposableStore();
  private readonly logger: Logger;
  private readonly onBuildEmitter = new Emitter<ServerFunctionBuildResult>();
  private readonly service: Service;
  private readonly settings: NostalgieSettings;
  private readonly watcher = watch([], { ignoreInitial: true, usePolling: true, interval: 16 });
  private readonly watchedFiles = new Set<string>();

  constructor(options: ServerFunctionBuilderOptions) {
    this.delayer = new ThrottledDelayer(options.throttleInterval ?? 0);

    this.disposer.add(this.delayer);
    this.disposer.add(this.onBuildEmitter);
    this.disposer.add(toDisposable(() => this.watcher.close()));

    this.logger = options.logger;
    this.service = options.service;
    this.settings = options.settings;
  }

  get onBuild() {
    return this.onBuildEmitter.event;
  }

  async build() {
    const start = Date.now();

    if (!this.settings.functionsEntryPoint) {
      this.logger.info(
        { latency: Date.now() - start },
        'Server functions build skipped; no functions entrypoint found.'
      );

      return this.onBuildEmitter.fire({
        functionNames: [],
        serverFunctionsEntry: null,
      });
    }

    this.logger.debug('Starting client asset build');
    this.logger.info('Starting server functions build');

    const rootDir = this.settings.rootDir;
    const functionsMetaPath = Path.resolve(rootDir, 'build/functions/meta.json');
    const functionsBuildPath = 'build/functions/functions.js';
    const resolveExtensions = [...this.settings.resolveExtensions];

    const buildResult = await this.service.build({
      bundle: false,
      define: {
        'process.env.NODE_ENV': JSON.stringify(this.settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      logLevel: 'error',
      entryPoints: [`./${Path.relative(rootDir, this.settings.functionsEntryPoint)}`],
      external: [],
      format: 'esm',
      incremental: false,
      loader: this.settings.loaders,
      metafile: functionsMetaPath,
      minify: this.settings.buildEnvironment === 'production',
      outbase: Path.resolve(this.settings.functionsEntryPoint, '../nostalgie'),
      outfile: Path.resolve(rootDir, functionsBuildPath),
      platform: 'node',
      plugins: [],
      publicPath: '/static/build',
      resolveExtensions,
      sourcemap: false,
      splitting: false,
      treeShaking: true,
      write: false,
    });

    const metaFile = buildResult.outputFiles.find((file) => file.path === functionsMetaPath);

    if (!metaFile) {
      throw new Error(
        `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
      );
    }

    const metaFileContents = metaFile.text;

    const metaFileData: Metadata = JSON.parse(metaFileContents);
    const functionsOutput = metaFileData.outputs[functionsBuildPath];

    if (!functionsOutput) {
      throw new Error(
        `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
      );
    }

    const newInputFiles = new Set(Object.keys(metaFileData.inputs));

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

    const functionsShimImports = metaFileData.inputs[Object.keys(metaFileData.inputs)[0]];

    if (!functionsShimImports) {
      throw new Error(
        `Invariant violation: Unable to locate the functions shim metadata in the function build input metadata for ${Path.resolve(
          rootDir,
          functionsBuildPath
        )}`
      );
    }

    this.logger.info({ latency: Date.now() - start }, 'Finished server functions build');

    this.onBuildEmitter.fire({
      functionNames: functionsOutput.exports,
      /**
       * Absolute path to the USER's functions file
       */
      // serverFunctionsSourcePath: Path.resolve(rootDir, functionsShimImports.imports[0].path),
      serverFunctionsEntry: Path.resolve(rootDir, functionsBuildPath),
    });
  }

  dispose() {
    return this.disposer.dispose();
  }

  async start() {
    await this.delayer.trigger(() => {
      return this.build();
    });
    this.watcher.on('all', () => {
      this.build();
    });
  }
}
