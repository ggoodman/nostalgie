import type { Context } from '@ggoodman/context';
import reactRefreshPlugin from '@vitejs/plugin-react';
import Debug from 'debug';
import fastify, { FastifyReply } from 'fastify';
import { Headers } from 'headers-utils/lib';
import { createServer, InlineConfig } from 'vite';
import { createMdxPlugin } from './build/plugins/mdx';
import type { NostalgieConfig } from './config';
import { NOSTALGIE_MANIFEST_MODULE_ID } from './constants';
import type { Logger } from './logging';
import type { Plugin } from './plugin';
import { nostalgieClientEntryPlugin } from './plugins/nostalgieClientEntry';
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

  const viteConfig: InlineConfig = {
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
      // new Proxy(
      //   {
      //     name: 'pre-observer',
      //     enforce: 'pre' as const,
      //   },
      //   {
      //     get(target, prop, receiver) {
      //       switch (prop) {
      //         case 'apply':
      //         case 'name':
      //         case 'enforce':
      //           return Reflect.get(target, prop, receiver);
      //         default:
      //           return () => debug('pre.%s', prop);
      //       }
      //     },
      //   }
      // ),
      // new Proxy(
      //   {
      //     name: 'post-observer',
      //     enforce: 'post' as const,
      //   },
      //   {
      //     get(target, prop, receiver) {
      //       switch (prop) {
      //         case 'apply':
      //         case 'name':
      //         case 'enforce':
      //           return Reflect.get(target, prop, receiver);
      //         default:
      //           return () => debug('post.%s', prop);
      //       }
      //     },
      //   }
      // ),
      ...(config.settings.plugins || []),
      errorBoundaryPlugin(),
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
    ],
  };

  for (const plugin of viteConfig.plugins! as Plugin[]) {
    if (typeof plugin?.preconfigure === 'function') {
      await plugin?.preconfigure(config, viteConfig);
    }
  }

  const vite = await createServer(viteConfig);

  ctx.onDidCancel(() => {
    debug('dev server context cancelled');
    vite.close();
  });

  const server = fastify({
    // If we don't do this, the context will wait indefinitely for all
    // open connections to close.
    forceCloseConnections: true,
  });

  server.route({
    method: 'GET',
    url: '/favicon.ico',
    handler: async (request, reply) => {
      return reply.code(404);
    },
  });

  server.route({
    method: 'GET',
    url: '/*',
    handler: async (request, reply) => {
      try {
        const serverApp = (await vite.ssrLoadModule(serverEntrypointUrl)) as {
          render: import('./runtime/server/renderer').ServerRenderer['render'];
        };

        if (serverApp == null || typeof serverApp.render !== 'function') {
          throw new Error('Error importing SSR module');
        }

        const res = await new Promise<FastifyReply>((resolve, reject) => {
          vite.middlewares(request.raw, reply.raw, (err: Error) => {
            if (err) {
              return reject(err);
            }

            const req = {
              body: '',
              headers: new Headers(request.headers as any),
              method: request.method,
              path: request.url,
            };

            return serverApp.render(req).then(({ errors, response, stats }) => {
              const html = response.body as string;
              const res = reply
                .code(response.status)
                .headers(Object.fromEntries(response.headers.entries()))
                .send(html);

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

  const uri = await server.listen({
    port: 3000,
    host: 'localhost',
  });

  logger.onServerListening(uri);

  ctx.onDidCancel(() => server.close());

  await new Promise<void>((resolve) =>
    server.addHook('onClose', () => {
      debug('fastify server onClose');
      return resolve();
    })
  );
}
