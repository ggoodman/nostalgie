import type { AbortSignal } from 'abort-controller';
import type { Service } from 'esbuild';
import * as Path from 'path';
import type { Logger } from 'pino';
import type { CancellationToken } from 'ts-primitives';
import { DisposableStore, Event, ThrottledDelayer } from 'ts-primitives';
import { createRequire } from '../createRequire';
import type { NostalgieServer } from '../runtime/internal/runtimes/node';
import type { NostalgieSettings } from '../settings';
import { ClientAssetBuilder } from './builders/client';
import { ServerFunctionsBuilder } from './builders/functions';
import { NodeServerBuilder } from './builders/server';
import { ServerRendererBuilder } from './builders/ssr';

export interface BuilderOptions {
  logger: Logger;
  settings: NostalgieSettings;
  service: Service;
  throttleInterval?: number;
  token: CancellationToken;
}

export class Builder {
  private readonly delayer: ThrottledDelayer<unknown>;
  private readonly disposer = new DisposableStore();
  private readonly functionsBuilder: ServerFunctionsBuilder;
  private readonly clientAssetBuilder: ClientAssetBuilder;
  private readonly logger: Logger;
  private nodeServerPath?: string;
  private server?: NostalgieServer;
  private readonly serverRendererBuilder: ServerRendererBuilder;
  private readonly settings: NostalgieSettings;
  private readonly nodeServerBuilder: NodeServerBuilder;
  private readonly token: CancellationToken;

  constructor(options: BuilderOptions) {
    const { logger, settings, service, token } = options;

    this.delayer = new ThrottledDelayer(options.throttleInterval ?? 0);
    this.logger = logger;
    this.settings = settings;
    this.token = token;

    token.onCancellationRequested(() => {
      this.disposer.dispose();
    });

    this.functionsBuilder = new ServerFunctionsBuilder({
      logger,
      service,
      settings,
    });
    this.disposer.add(this.functionsBuilder);

    this.clientAssetBuilder = new ClientAssetBuilder({
      functionsBuilder: this.functionsBuilder,
      logger,
      service,
      settings,
      token,
    });
    this.disposer.add(this.clientAssetBuilder);

    this.serverRendererBuilder = new ServerRendererBuilder({
      clientAssetBuilder: this.clientAssetBuilder,
      logger,
      service,
      settings,
      token,
    });
    this.disposer.add(this.serverRendererBuilder);

    this.nodeServerBuilder = new NodeServerBuilder({
      logger,
      service,
      settings,
      ssrBuilder: this.serverRendererBuilder,
    });
    this.disposer.add(this.nodeServerBuilder);
  }

  async build() {
    const start = Date.now();
    const { functionsBuilder, clientAssetBuilder, serverRendererBuilder, nodeServerBuilder } = this;

    const functionsBuildPromise = Event.toPromise(functionsBuilder.onBuild);
    const clientAssetBuildPromise = Event.toPromise(clientAssetBuilder.onBuild);
    const serverRendererBuildPromise = Event.toPromise(serverRendererBuilder.onBuild);
    const nodeServerBuildPromise = Event.toPromise(nodeServerBuilder.onBuild);

    await Promise.all([
      functionsBuilder.start(),
      clientAssetBuilder.start(),
      serverRendererBuilder.start(),
      nodeServerBuilder.start(),
    ]);

    await Promise.all([
      functionsBuildPromise,
      clientAssetBuildPromise,
      serverRendererBuildPromise,
      nodeServerBuildPromise,
    ]);

    this.logger.info({ latency: Date.now() - start }, 'Build completed');
  }

  async watch(options: {
    host: string;
    automaticReload: boolean;
    port: number;
    signal: AbortSignal;
  }) {
    const { functionsBuilder, clientAssetBuilder, serverRendererBuilder, nodeServerBuilder } = this;

    nodeServerBuilder.onBuild(({ nodeServerPath }) => {
      this.nodeServerPath = nodeServerPath;
      this.delayer.trigger(async () => {
        if (this.server) {
          await this.server.methods.reloadPool();
        } else {
          await this.startOrRestartServer(options);
        }
      });
    });

    serverRendererBuilder.onBuild(() => {
      this.delayer.trigger(async () => {
        if (this.server) {
          await this.server.methods.reloadPool();
        } else {
          await this.startOrRestartServer(options);
        }
      });
    });

    await Promise.all([
      functionsBuilder.start(),
      clientAssetBuilder.start(),
      serverRendererBuilder.start(),
      nodeServerBuilder.start(),
    ]);

    await Event.toPromise(this.token.onCancellationRequested as any);
  }

  private async startOrRestartServer(options: {
    automaticReload: boolean;
    host: string;
    port: number;
    signal: AbortSignal;
  }) {
    const nodeServerPath = this.nodeServerPath;
    if (!nodeServerPath) {
      return;
    }
    const buildRelativeRequire = createRequire(Path.join(this.settings.buildDir, 'index.js'));

    // TODO: Fix this type when we're back under control (typeof import('../runtime/server/node'))
    const { initializeServer } = buildRelativeRequire(
      nodeServerPath
    ) as typeof import('../runtime/internal/runtimes/node');

    this.logger.debug({ initializeServer, nodeServerPath }, 'loaded server');

    const initializationPromise = initializeServer({
      auth: this.settings.auth,
      automaticReload: options.automaticReload,
      buildDir: this.settings.buildDir,
      host: options.host,
      port: options.port,
      logger: this.logger,
      signal: options.signal,
    });

    initializationPromise.catch(() => {
      // Ignore error for now. We await this promise
      // later
    });

    if (this.server) {
      await this.server.stop({ timeout: 5000 });
    }

    this.server = await initializationPromise;

    try {
      await this.server.start();
    } catch (err) {
      this.logger.warn({ err }, 'error while starting server, waiting for changes');
    }
  }
}
