import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController, AbortSignal } from 'abort-controller';
import HapiPino from 'hapi-pino';
import Joi from 'joi';
import * as Path from 'path';
import { pool } from 'workerpool';
import { wireAbortController } from '../../../lifecycle';
import { createDefaultLogger, Logger } from '../../../logging';
import type { NostalgieAuthOptions } from '../../../settings';
import type { ServerFunctionContext } from '../../functions/types';
import type { ServerRenderRequest } from '../../server';
import { authPlugin } from './auth';
import { MemoryCacheDriver } from './memoryCacheDriver';

export interface StartServerOptions {
  buildDir?: string;
  host?: string;
  logger?: Logger;
  port?: number;
  signal?: AbortSignal;
  auth?: NostalgieAuthOptions;
}

export async function startServer(options: StartServerOptions) {
  const buildDir = options.buildDir ?? __dirname;
  const server = new Hapi.Server({
    address: options.host ?? '0.0.0.0',
    port: options.port ?? process.env.PORT ?? 8080,
    host: options.host,
    cache: MemoryCacheDriver,
  });

  if (options.auth) {
    await server.register({
      plugin: authPlugin,
      options: options.auth,
    });
  }

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

  const workerPool = pool(Path.resolve(buildDir, './ssr.js'), {
    // workerType: 'auto',
    // forkOpts: {
    //   stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    // },
    // minWorkers: 1,
    // maxWorkers: 1,
  });

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
  const renderAppOnServer = server.methods
    .renderAppOnServer as import('../../server').ServerRenderer['renderAppOnServer'];

  server.method(
    'invokeFunction',
    (functionName: string, ctx: ServerFunctionContext, args: any[]) => {
      return workerPool.exec('invokeFunction', [functionName, ctx, args]);
    }
  );
  const invokeFunction = server.methods
    .invokeFunction as import('../../server').ServerRenderer['invokeFunction'];

  server.route({
    method: 'POST',
    path: '/.nostalgie/rpc',
    options: {
      cors: false,
      validate: {
        payload: Joi.object({
          functionName: Joi.string().required(),
          args: Joi.array().required(),
        }),
      },
    },
    handler: async (request, h) => {
      const abortController = new AbortController();
      const { functionName, args } = request.payload as {
        functionName: string;
        args: any[];
      };
      const ctx: ServerFunctionContext = {
        auth: request.auth,
        signal: abortController.signal,
      };
      const functionResults = await invokeFunction(functionName, ctx, args);

      return h.response(JSON.stringify(functionResults)).type('application/json');
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
    method: 'GET',
    path: '/{any*}',
    options: {},
    handler: async (request, h) => {
      const { html, latency, renderCount } = await renderAppOnServer({
        auth: request.auth,
        path: request.path,
      });

      request.logger.info(
        {
          latency,
          renderCount,
        },
        'rendered app'
      );

      return h.response(html).header('content-type', 'text/html');
    },
  });

  await server.start();

  return server;
}
