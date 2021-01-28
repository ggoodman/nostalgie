import { watch } from 'chokidar';
import type { Metadata, Service } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { Logger } from 'pino';
import { DisposableStore, Emitter, ThrottledDelayer, toDisposable } from 'ts-primitives';
import { createRequire } from '../../createRequire';
import type { NostalgieSettings } from '../../settings';

export interface NodeServerBuildResult {
  nodeServerPath: string;
}

export interface NodeServerBuilderOptions {
  logger: Logger;
  service: Service;
  settings: NostalgieSettings;
  throttleInterval?: number;
}

export class NodeServerBuilder {
  private readonly delayer: ThrottledDelayer<unknown>;
  private readonly disposer = new DisposableStore();
  private readonly logger: Logger;
  private readonly onBuildEmitter = new Emitter<NodeServerBuildResult>();
  private readonly service: Service;
  private readonly settings: NostalgieSettings;
  private readonly watcher = watch([], { ignoreInitial: true });
  private readonly watchedFiles = new Set<string>();

  constructor(options: NodeServerBuilderOptions) {
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
    this.logger.debug('Starting node server build');

    const buildDir = this.settings.buildDir;
    const metaPath = Path.resolve(buildDir, './nodeServerMetadata.json');
    const appRequire = createRequire(this.settings.applicationEntryPoint);
    const nostalgieHapiServerPath = appRequire.resolve('nostalgie/internal/runtimes/node');
    // const nostalgiePiscinaWorkerPath = Path.resolve(require.resolve('piscina'), '../worker.js');
    const resolveExtensions = [...this.settings.resolveExtensions];
    const nodeServerPath = Path.resolve(this.settings.buildDir, './index.js');

    await this.service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(this.settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      format: 'cjs',
      logLevel: 'error',
      metafile: metaPath,
      minify: this.settings.buildEnvironment === 'production',
      outfile: nodeServerPath,
      publicPath: '/static/build',
      platform: 'node',
      plugins: [],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: `
  const { initializeServer, main, startServer } = require(${JSON.stringify(
    nostalgieHapiServerPath
  )});
  
  exports.initializeServer = initializeServer;
  exports.startServer = startServer;
  
  if (require.main === module) {
    main({
      buildDir: __dirname,
    });
  }
          `,
        loader: 'js',
        resolveDir: this.settings.rootDir,
        sourcefile: Path.resolve(this.settings.applicationEntryPoint, '../server.js'),
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

    this.logger.debug({ latency: Date.now() - start }, 'Finished node server build');

    this.onBuildEmitter.fire({ nodeServerPath });
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
