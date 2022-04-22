import type { Context } from '@ggoodman/context';
import { Server, type ResponseObject } from '@hapi/hapi';
import reactRefreshPlugin from '@vitejs/plugin-react';
import Debug from 'debug';
import { Headers } from 'headers-utils/lib';
import { createServer } from 'vite';
import { createMdxPlugin } from './build/plugins/mdx';
import type { NostalgieConfig } from './config';
import { NOSTALGIE_MANIFEST_MODULE_ID } from './constants';
import type { Logger } from './logging';
import { nostalgieClientEntryPlugin } from './plugins/nostalgieClientEntry';
import { nostalgieConfigPlugin } from './plugins/nostalgieConfig';
import { nostalgiePluginsPlugin } from './plugins/nostalgiePlugins';
import { nostalgieServerEntryPlugin } from './plugins/nostalgieServerEntry';
import { errorBoundaryPlugin } from './runtime/server/plugins/errorBoundary';

const debug = Debug.debug('nostalgie:dev');

export async function runDevServer(
  ctx: Context,
  logger: Logger,
  runCount: number,
  config: NostalgieConfig
) {
  logger.onValidConfiguration(config);

  const clientEntrypointUrl = `/nostalgie.client.js`;
  const serverEntrypointUrl = `/nostalgie.server.js`;
  const serverRenderPluginImports: string[] = [];
  const serverRenderPluginInstantiations: string[] = [];
  const clientRenderPluginImports: string[] = [];
  const clientRenderPluginInstantiations: string[] = [];

  const vite = await createServer({
    root: config.rootDir,
    build: {},
    configFile: false,
    server: {
      middlewareMode: 'ssr',
      hmr: true,
    },
    esbuild: {
      exclude: ['esbuild'],
    },
    clearScreen: false,
    logLevel: 'info',
    plugins: [
      errorBoundaryPlugin(),
      nostalgieConfigPlugin(config),
      nostalgiePluginsPlugin({
        serverRenderPluginImports,
        serverRenderPluginInstantiations,
        clientRenderPluginImports,
        clientRenderPluginInstantiations,
      }),
      nostalgieServerEntryPlugin({
        config,
        clientEntrypointUrl,
        serverEntrypointUrl,
        serverRenderPluginImports,
        serverRenderPluginInstantiations,
      }),
      nostalgieClientEntryPlugin({
        config,
        clientEntrypointUrl,
        clientRenderPluginImports,
        clientRenderPluginInstantiations,
      }),
      {
        name: 'nostalgie-plugin-asset-manifest',
        resolveId(source) {
          if (source === NOSTALGIE_MANIFEST_MODULE_ID) {
            return {
              id: NOSTALGIE_MANIFEST_MODULE_ID,
            };
          }

          return undefined;
        },
        load(id, options) {
          if (id === NOSTALGIE_MANIFEST_MODULE_ID) {
            return {
              code: '{}',
            };
          }
        },
      },
      reactRefreshPlugin({}),
      createMdxPlugin(),
      ...(config.settings.plugins || []),
    ],
  });

  ctx.onDidCancel(() => {
    debug('dev server context cancelled');
    vite.close();
  });

  const server = new Server({
    host: 'localhost',
    port: 3000,
  });

  server.route({
    method: 'get',
    path: '/favicon.ico',
    handler: async (request, h) => {
      return h.response().code(404);
    },
  });

  server.route({
    method: 'get',
    path: '/{any*}',
    handler: async (request, h) => {
      try {
        const serverApp = (await vite.ssrLoadModule(serverEntrypointUrl)) as {
          render: import('./runtime/server/renderer').ServerRenderer['render'];
        };

        if (serverApp == null || typeof serverApp.render !== 'function') {
          throw new Error('Error importing SSR module');
        }

        const res = await new Promise<ResponseObject>((resolve, reject) => {
          vite.middlewares(request.raw.req, request.raw.res, (err: Error) => {
            if (err) {
              return reject(err);
            }

            const req = {
              body: '',
              headers: new Headers(request.headers as any),
              method: request.method,
              path: request.url.pathname,
            };

            return serverApp.render(req).then(({ errors, response, stats }) => {
              const html = response.body as string;
              const res = h.response(html).code(response.status);

              response.headers.forEach((value, key) => {
                res.header(key, value);
              });

              logger.onServerRendered({ errors, request: req, stats });

              return resolve(res);
            }, reject);
          });
        });

        return res;
      } catch (err: any) {
        logger.onServerRenderError(err);

        throw err;
      }
    },
  });

  await server.start();

  logger.onServerListening(server.info.uri);

  ctx.onDidCancel(() => server.stop());

  await new Promise<void>((resolve) =>
    server.ext('onPostStop', () => {
      debug('hapi server onPostStop');
      return resolve();
    })
  );
}
