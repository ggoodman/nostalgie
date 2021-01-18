import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController, AbortSignal } from 'abort-controller';
import HapiPino from 'hapi-pino';
import Joi from 'joi';
import Module from 'module';
import { cpus } from 'os';
import * as Path from 'path';
import { pool } from 'workerpool';
import { wireAbortController } from '../../../lifecycle';
import { createDefaultLogger, Logger } from '../../../logging';
import type { ServerFunctionContext } from '../../functions/types';

const createRequire = Module.createRequire || Module.createRequireFromPath;
const require = createRequire(__filename);

export async function startServer(
  logger: Logger,
  options: {
    buildDir: string;
    port?: number;
    host?: string;
    signal: AbortSignal;
  }
) {
  const buildDir = options.buildDir;
  const server = new Hapi.Server({
    address: options.host ?? '0.0.0.0',
    port: options.port ?? process.env.PORT ?? 8080,
    host: options.host,
  });

  const signal = options.signal;
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

  const workerPool = pool(Path.resolve(options.buildDir, './ssr.js'), {
    workerType: 'auto',
    forkOpts: {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    },
    minWorkers: cpus().length,
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
    (pathname: string) => {
      return workerPool.exec('renderAppOnServer', [pathname]);
    },
    {
      cache: {
        expiresIn: 1000,
        generateTimeout: 5000,
        staleIn: 500,
        staleTimeout: 1,
      },
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
    path: '/_nostalgie/rpc',
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
        user: null,
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
    path: '/static/{path*}',
    options: {
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
    handler: async (request, h) => {
      const { html } = await renderAppOnServer(request.path);

      return h.response(html).header('content-type', 'text/html');
    },
  });

  await server.start();

  return server;
}

if (require.main === module) {
  const logger = createDefaultLogger();
  const signal = wireAbortController(logger);

  startServer(logger, {
    buildDir: __dirname,
    signal,
  }).catch((err) => {
    logger.fatal({ err }, 'exception thrown while starting server');
  });
}
