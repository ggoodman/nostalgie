import Boom from '@hapi/boom';
import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController, AbortSignal } from 'abort-controller';
import HapiPino from 'hapi-pino';
import Joi from 'joi';
import * as Path from 'path';
import { PassThrough, Stream } from 'stream';
import { pool, WorkerPool } from 'workerpool';
import { wireAbortController } from '../../../../lifecycle';
import { createDefaultLogger, Logger } from '../../../../logging';
import { NostalgieAuthOptions, readAuthOptions } from '../../../../settings';
import type { ServerAuth, ServerAuthCredentials } from '../../../auth/server';
import { RPCMimeType, RPCResultKind } from '../../../functions/constants';
import { errorToWireData } from '../../../functions/internal';
import type { ServerFunctionContext } from '../../../functions/types';
import type { ServerRenderRequest } from '../../renderer';
import { authPlugin } from './auth';
import { MemoryCacheDriver } from './memoryCacheDriver';

const POOL_RELOADED_EVENT = 'poolReloaded';

export interface StartServerOptions {
  automaticReload?: boolean;
  buildDir?: string;
  host?: string;
  logger?: Logger;
  port?: number;
  signal?: AbortSignal;
  auth?: NostalgieAuthOptions;
}

export function main(options: StartServerOptions) {
  const logger = createDefaultLogger();
  const auth = readAuthOptions(options);

  return startServer({
    auth: auth,
    buildDir: options.buildDir,
    host: options.host,
    logger,
    port: options.port,
    signal: wireAbortController(logger).signal,
  }).catch((err) => {
    logger.fatal({ err }, 'Error while starting the server');
  });
}

export interface NostalgieServer extends Hapi.Server {
  methods: {
    invokeFunction: import('../../renderer').ServerRenderer['invokeFunction'];
    reloadPool(): Promise<void>;
    renderAppOnServer: import('../../renderer').ServerRenderer['renderAppOnServer'];
  };
}

export async function initializeServer(options: StartServerOptions): Promise<NostalgieServer> {
  const buildDir = options.buildDir ?? __dirname;
  const server = new Hapi.Server({
    address: options.host ?? '0.0.0.0',
    port: options.port ?? process.env.PORT ?? 8080,
    host: options.host,
  }) as NostalgieServer;

  server.cache.provision({
    provider: MemoryCacheDriver as Hapi.CacheProvider<any>,
    name: 'memory',
  });

  const logger = options.logger ?? createDefaultLogger();
  const signal = options.signal ?? wireAbortController(logger).signal;
  const onAbort = () => {
    signal.removeEventListener('abort', onAbort);
    logger.info({ timeout: 5000 }, 'starting graceful server shutdown');
    server.stop({ timeout: 5000 }).catch((err) => {
      logger.error({ err }, 'error stopping server');
    });
  };
  signal.addEventListener('abort', onAbort);

  await server.register([
    {
      plugin: HapiPino,
      options: {
        instance: logger,
        logPayload: false,
        logRequestComplete: false,
        logRequestStart: false,
      },
    },
    {
      plugin: HapiInert,
      options: {},
    },
  ]);

  if (options.auth) {
    await server.register({
      plugin: authPlugin,
      options: { auth: options.auth, publicUrl: server.info.uri },
    });
  }

  const createPool = () =>
    pool(Path.resolve(buildDir, './ssr.js'), {
      // workerType: 'auto',
      // forkOpts: {
      //   stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      // },
      // minWorkers: 1,
      // maxWorkers: 1,
    });

  const recreatePool = async () => {
    if (workerPool) {
      server.logger.info('recreating server renderer worker pool');

      await workerPool.terminate(true).catch(() => {
        // Swallow errors
      });
    }

    workerPool = createPool();

    server.events.emit(POOL_RELOADED_EVENT, true);

    return workerPool;
  };
  let workerPool: WorkerPool = createPool();

  server.event(POOL_RELOADED_EVENT);
  server.method('reloadPool', recreatePool);

  server.ext('onPreStop', async () => {
    try {
      await workerPool.terminate();
    } catch {
      // Worker pool has some termination race conditions... swallow em
    }
  });

  server.method(
    'renderAppOnServer',
    (request: ServerRenderRequest) => {
      return workerPool.exec('renderAppOnServer', [request]);
    },
    {
      // cache: {
      //   expiresIn: 1000,
      //   generateTimeout: 5000,
      //   staleIn: 500,
      //   staleTimeout: 1,
      // },
    }
  );
  const renderAppOnServer = server.methods.renderAppOnServer;

  server.method(
    'invokeFunction',
    (functionName: string, ctx: ServerFunctionContext, args: any[]) => {
      return workerPool.exec('invokeFunction', [functionName, ctx, args]);
    }
  );
  const invokeFunction = server.methods.invokeFunction;

  if (options.automaticReload) {
    logger.debug('Starting automatic restart handler');

    server.route({
      method: 'GET',
      path: '/.nostalgie/events',
      options: {
        cache: false,
        timeout: {
          server: false,
          socket: 5000,
        },
      },
      handler(request, h) {
        const eventStream = new PassThrough();
        const res = h
          .response(eventStream)
          .code(200)
          .header('content-type', 'text/event-stream')
          .header('content-encoding', 'identity');
        const interval = setInterval(() => {
          eventStream.write(`event: ping\r\ndata: ${Date.now()}\r\n\r\n`);
        }, 2000);

        const onPoolReload = () => {
          eventStream.write(`event: reload\r\ndata: ${Date.now()}\r\n\r\n`);
        };
        server.events.addListener(POOL_RELOADED_EVENT, onPoolReload);

        request.events.on('disconnect', () => {
          clearInterval(interval);
          server.events.removeListener(POOL_RELOADED_EVENT, onPoolReload);
        });

        return res;
      },
    });
  }

  server.route({
    method: 'POST',
    path: '/.nostalgie/rpc',
    options: {
      cors: false,
      validate: {
        payload: Joi.array().items(
          Joi.object({
            functionName: Joi.string().required(),
            args: Joi.array().required(),
          })
        ),
      },
    },
    handler: async (request, h) => {
      const abortController = new AbortController();
      const requests = request.payload as ReadonlyArray<{
        functionName: string;
        args: any[];
      }>;
      const ctx: ServerFunctionContext = {
        auth: requestAuthToServerAuth(request.auth),
        signal: abortController.signal,
      };

      const stream = new Stream.PassThrough();
      const res = h.response(stream).type(RPCMimeType);
      const functionPromises: Promise<void>[] = [];

      for (let i = 0; i < requests.length; i++) {
        const idx = i;
        const { functionName, args } = requests[idx];
        const functionResultPromise = invokeFunction(functionName, ctx, args).then(
          (functionResult) => {
            stream.write(`${idx}\t${RPCResultKind.Success}\t${JSON.stringify(functionResult)}`);
          },
          (err) => {
            stream.write(`${idx}\t${RPCResultKind.Error}\t${JSON.stringify(errorToWireData(err))}`);
          }
        );

        functionPromises.push(functionResultPromise);
      }

      Promise.all(functionPromises).then(() => {
        stream.end();
      });

      return res;
    },
  });

  server.route({
    method: 'GET',
    path: '/favicon.ico',
    options: {
      auth: false,
      cache: {
        expiresIn: 30 * 1000,
        privacy: 'public',
      },
    },
    handler: {
      file: {
        path: Path.join(buildDir, 'static', 'favicon.ico'),
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/robots.txt',
    options: {
      auth: false,
      cache: {
        expiresIn: 30 * 1000,
        privacy: 'public',
      },
    },
    handler() {
      return (
        `
User-agent: *
Disallow: /
      `.trim() + '\n'
      );
    },
  });

  server.route({
    method: 'GET',
    path: '/static/{path*}',
    options: {
      auth: false,
      cache: {
        expiresIn: 30 * 1000,
        privacy: 'public',
      },
    },
    handler: {
      directory: {
        etagMethod: 'hash',
        index: false,
        listing: false,
        lookupCompressed: false,
        path: Path.join(buildDir, 'static'),
        redirectToSlash: false,
        showHidden: false,
      },
    },
  });

  server.route({
    method: 'ANY',
    path: '/.nostalgie/{any*}',
    options: {
      auth: false,
    },
    handler: (_request, h) => {
      throw Boom.notFound();
    },
  });

  server.route({
    method: 'GET',
    path: '/{any*}',
    options: {},
    handler: async (request, h) => {
      const { html, latency, queries, renderCount } = await renderAppOnServer({
        auth: requestAuthToServerAuth(request.auth),
        automaticReload: options.automaticReload,
        path: request.path,
      });

      request.logger.info(
        {
          latency,
          queries,
          renderCount,
        },
        'rendered app'
      );

      return h.response(html).header('content-type', 'text/html');
    },
  });

  await server.initialize();

  return server;
}

export async function startServer(options: StartServerOptions) {
  const server = await initializeServer(options);

  await server.start();

  return server;
}

function requestAuthToServerAuth(auth: Hapi.RequestAuth): ServerAuth {
  return auth.isAuthenticated
    ? {
        isAuthenticated: true,
        credentials: (auth.credentials as unknown) as ServerAuthCredentials,
      }
    : {
        isAuthenticated: false,
        error: auth.error,
      };
}
