import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController, AbortSignal } from 'abort-controller';
import HapiPino from 'hapi-pino';
import Joi from 'joi';
import type { ServerFunctionContext } from 'nostalgie';
import type { BootstrapOptions } from 'nostalgie/internals';
import { cpus } from 'os';
import * as Path from 'path';
import { pool } from 'workerpool';
import { wireAbortController } from './lifecycle';
import { createDefaultLogger, Logger } from './logging';

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
    minWorkers: cpus().length,
  });

  server.ext('onPreStop', () => {
    workerPool.terminate();
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
    .renderAppOnServer as typeof import('./ssr').renderAppOnServer;

  server.method(
    'invokeFunction',
    (functionName: string, ctx: ServerFunctionContext, args: any[]) => {
      return workerPool.exec('renderAppOnServer', [functionName, ctx, args]);
    }
  );
  const invokeFunction = server.methods.invokeFunction as typeof import('./ssr').invokeFunction;

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
      const { headTags, markup, preloadScripts, reactQueryState } = await renderAppOnServer(
        request.path
      );
      const publicUrl = encodeURI('');

      const bootstrapOptions: BootstrapOptions = {
        lazyComponents: preloadScripts,
        reactQueryState,
      };

      const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Web site created using nostalgie"
    />
    <link rel="apple-touch-icon" href="${publicUrl}/logo192.png" />
    <link rel="modulepreload" href="${publicUrl}/static/build/bootstrap.js" />
    ${preloadScripts.map(
      ({ chunk }) => `<link rel="modulepreload" href="${publicUrl}/${encodeURI(chunk)}" />`
    )}
    ${headTags.join('\n')}
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root">${markup}</div>
    <script type="module">
      import { start } from "${publicUrl}/static/build/bootstrap.js";

      start(${JSON.stringify(bootstrapOptions)});
    </script>
  </body>
</html>
      `.trim();

      return h.response(html).header('content-type', 'text/html');
    },
  });

  await server.start();

  return server;
}

if (!require.main) {
  const logger = createDefaultLogger();
  const signal = wireAbortController(logger);

  startServer(logger, {
    buildDir: __dirname,
    signal,
  }).catch((err) => {
    logger.fatal({ err }, 'exception thrown while starting server');
  });
}
