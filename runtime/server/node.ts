import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController } from 'abort-controller';
import HapiPino from 'hapi-pino';
import Joi from 'joi';
import type { ServerFunctionContext } from 'nostalgie';
import type { BootstrapOptions } from 'nostalgie/internals';
import * as Path from 'path';
import Pino, { Logger } from 'pino';
import Piscina from 'piscina';
import { MethodKind } from './constants';
import type { RenderTreeResult } from './ssr';

export async function startServer(
  logger: Logger,
  options: {
    buildDir: string;
    port?: number;
    host?: string;
  }
) {
  const buildDir = options.buildDir;
  const server = new Hapi.Server({
    address: options.host ?? '0.0.0.0',
    port: options.port ?? process.env.PORT ?? 8080,
    host: options.host,
  });

  const signal = wireAbortController(logger);

  signal.addEventListener('abort', () => {
    logger.info({ timeout: 60000 }, 'starting graceful server shutdown');
    server.stop({ timeout: 60000 }).catch((err) => {
      logger.error({ err }, 'error stopping server');
    });
  });

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

  const piscina = new Piscina({
    filename: Path.resolve(options.buildDir, './ssr.js'),
  });

  function invokeWorker(
    op: MethodKind.INVOKE_FUNCTION,
    args: { functionName: string; ctx: ServerFunctionContext; args: any[] }
  ): Promise<unknown>;
  function invokeWorker(
    op: MethodKind.RENDER_TREE,
    args: { path: string }
  ): Promise<RenderTreeResult>;
  function invokeWorker(op: MethodKind, args: unknown) {
    return piscina.runTask({ op, args });
  }

  server.method(
    'renderOnServer',
    (pathname: string) => invokeWorker(MethodKind.RENDER_TREE, { path: pathname }),
    {
      cache: {
        expiresIn: 1000,
        generateTimeout: 5000,
        staleIn: 500,
        staleTimeout: 1,
      },
    }
  );
  const renderOnServer = server.methods.renderOnServer as (
    pathname: string
  ) => Promise<RenderTreeResult>;

  server.method('invokeFunction', (functionName: string, ctx: ServerFunctionContext, args: any[]) =>
    invokeWorker(MethodKind.INVOKE_FUNCTION, { functionName, ctx, args })
  );
  const invokeFunction = server.methods.invokeFunction as (
    functionName: string,
    ctx: ServerFunctionContext,
    args: any[]
  ) => Promise<unknown>;

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
      const { functionName, args } = request.payload as {
        functionName: string;
        args: any[];
      };
      const ctx: ServerFunctionContext = {
        user: null,
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
      const { headTags, markup, preloadScripts, reactQueryState } = await renderOnServer(
        request.path
      );
      const publicUrl = encodeURI('');

      const bootstrapOptions: BootstrapOptions = {
        lazyComponents: preloadScripts.map(([chunk, lazyImport]) => ({ chunk, lazyImport })),
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
    ${preloadScripts.map(
      ([href]) => `<link rel="modulepreload" href="${publicUrl}/${encodeURI(href)}" />`
    )}
    <link rel="modulepreload" href="${publicUrl}/static/build/bootstrap.js" />
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
}

function wireAbortController(logger: Logger) {
  const abortController = new AbortController();

  const onSignal: NodeJS.SignalsListener = (signal) => {
    logger.warn({ signal }, 'signal received, shutting down');
    abortController.abort();
  };

  const onUncaughtException: NodeJS.UncaughtExceptionListener = (err) => {
    logger.fatal({ err }, 'uncaught exception, shutting down');
    abortController.abort();
  };

  const onUnhandledRejection: NodeJS.UnhandledRejectionListener = (err) => {
    logger.fatal({ err }, 'unhandled rejection, shutting down');
    abortController.abort();
  };

  process
    .once('SIGINT', onSignal)
    .once('SIGTERM', onSignal)
    .on('uncaughtException', onUncaughtException)
    .on('unhandledRejection', onUnhandledRejection);

  return abortController.signal;
}

export const logger = Pino({
  serializers: Pino.stdSerializers,
  name: '@nostalgie/server',
  prettyPrint: process.env.NODE_ENV !== 'production',
  timestamp: Pino.stdTimeFunctions.isoTime,
});

if (!require.main) {
  startServer(logger, {
    buildDir: __dirname,
  }).catch((err) => {
    logger.fatal({ err }, 'exception thrown while starting server');
  });
}
