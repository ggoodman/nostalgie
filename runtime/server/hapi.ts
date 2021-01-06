import * as Boom from '@hapi/boom';
import * as Hapi from '@hapi/hapi';
import HapiInert from '@hapi/inert';
import { AbortController } from 'abort-controller';
import HapiPino from 'hapi-pino';
import * as Path from 'path';
import Pino, { Logger } from 'pino';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';
import type { BootstrapOptions } from '../browser/bootstrap';
import { renderAppOnServer } from './ssr';

declare const App: React.ComponentType;

export async function startServer(
  logger: Logger,
  options: {
    buildDir?: string;
    port?: number;
    host?: string;
  } = {}
) {
  const buildDir = options.buildDir || __dirname;
  const server = new Hapi.Server({
    address: options.host ?? '127.0.0.1',
    port: options.port ?? 9090,
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

  server.route({
    method: 'GET',
    path: '/favicon.ico',
    handler: async (request, h) => {
      return Boom.notImplemented();
    },
  });

  server.route({
    method: 'GET',
    path: '/logo192.png',
    handler: async (request, h) => {
      return Boom.notImplemented();
    },
  });

  server.route({
    method: 'GET',
    path: '/manifest.json',
    handler: async (request, h) => {
      return Boom.notImplemented();
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
      const { headTags, markup, preloadScripts } = await renderAppOnServer(App, request.path);
      const publicUrl = encodeURI('');

      const bootstrapOptions: BootstrapOptions = {
        lazyComponents: preloadScripts.map(([chunk, lazyImport]) => ({ chunk, lazyImport })),
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
      import("${publicUrl}/static/build/bootstrap.js")
        .then(({ start }) => start(${JSON.stringify(bootstrapOptions)}))
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

if (!module.parent) {
  startServer(logger).catch((err) => {
    logger.fatal({ err }, 'exception thrown while starting server');
  });
}
