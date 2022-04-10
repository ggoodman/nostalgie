import { Server } from '@hapi/hapi';
import reactRefreshPlugin from '@vitejs/plugin-react-refresh';
import Debug from 'debug';
import { Headers } from 'headers-utils/lib';
import jsesc from 'jsesc';
import * as Path from 'path';
import { createServer } from 'vite';
import type { NostalgieConfig } from './config';
import type { Context } from './context';
import type { Logger } from './logging';

const debug = Debug.debug('nostalgie:dev');

export async function runDevServer(
  ctx: Context,
  logger: Logger,
  runCount: number,
  config: NostalgieConfig
) {
  logger.onValidConfiguration(config);

  const entrypointUrl = `/nostalgie.js`;
  const syntheticEntrypointPath = Path.resolve(config.rootDir, entrypointUrl);
  const serverRenderPluginImports: string[] = [];
  const serverRenderPluginInstantiations: string[] = [];
  const clientRenderPluginImports: string[] = [];
  const clientRenderPluginInstantiations: string[] = [];

  if (config.settings.plugins?.length) {
    for (const plugin of config.settings.plugins) {
      if (typeof plugin.getClientRendererPlugins === 'function') {
        const refs = plugin.getClientRendererPlugins();
        const refsArr = Array.isArray(refs) ? refs : refs ? [refs] : [];

        for (const ref of refsArr) {
          const symbol = `plugin__${clientRenderPluginInstantiations.length}`;
          const target = ref.exportName
            ? `{ ${ref.exportName}: ${symbol} }`
            : symbol;

          // The import statement to pull in the client plugin
          clientRenderPluginImports.push(
            `import ${target} from ${jsesc(ref.spec, {
              isScriptContext: true,
              json: true,
            })};`
          );
          // The function call to instantiate the plugin with the config
          clientRenderPluginInstantiations.push(
            `${symbol}(${jsesc(ref.config, { isScriptContext: true })})`
          );
        }
      }

      if (typeof plugin.getServerRendererPlugins === 'function') {
        const refs = plugin.getServerRendererPlugins();
        const refsArr = Array.isArray(refs) ? refs : refs ? [refs] : [];

        for (const ref of refsArr) {
          const symbol = `plugin__${serverRenderPluginInstantiations.length}`;
          const target = ref.exportName
            ? `{ ${ref.exportName}: ${symbol} }`
            : symbol;

          // The import statement to pull in the server plugin
          serverRenderPluginImports.push(
            `import ${target} from ${jsesc(ref.spec, {
              isScriptContext: true,
              json: true,
            })};`
          );
          // The function call to instantiate the plugin with the config
          serverRenderPluginInstantiations.push(
            `${symbol}(${jsesc(ref.config, { isScriptContext: true })})`
          );
        }
      }
    }
  }

  const vite = await createServer({
    root: config.rootDir,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: true,
    },
    build: {
      rollupOptions: {
        input: [entrypointUrl],
      },
    },
    clearScreen: false,
    logLevel: 'info',
    optimizeDeps: {
      entries: [entrypointUrl, config.settings.appEntrypoint!],
    },
    plugins: [
      {
        name: 'nostalgie',
        resolveId(source, importer, options) {
          if (source === entrypointUrl) {
            return {
              id: syntheticEntrypointPath,
            };
          }

          return undefined;
        },
        load(id, options) {
          if (id === syntheticEntrypointPath) {
            const entrypointPath = Path.resolve(
              config.rootDir,
              config.settings.appEntrypoint!
            );
            const code = options?.ssr
              ? `
import App from ${jsesc(entrypointPath, {
                  isScriptContext: true,
                  json: true,
                })};
import { ServerRenderer } from "nostalgie/runtime/server";
${serverRenderPluginImports.join('\n')}

export function render(request) {
  const renderer = new ServerRenderer({
    appRoot: App,
    entrypointUrl: ${jsesc(entrypointUrl, {
      isScriptContext: true,
      json: true,
    })},
    publicUrl: 'https://localhost:3000/',
    plugins: [${serverRenderPluginInstantiations.join(',')}]
  });

  return renderer.render(request);
}

              `.trim()
              : `
import App from ${jsesc(entrypointPath, {
                  isScriptContext: true,
                  json: true,
                })};
import { ClientRenderer } from "nostalgie/runtime/client";
${clientRenderPluginImports.join('\n')}

export function render(request) {
  const renderer = new ClientRenderer({
    appRoot: App,
    entrypointUrl: ${jsesc(entrypointUrl, {
      isScriptContext: true,
      json: true,
    })},
    plugins: [${clientRenderPluginInstantiations.join(',')}]
  });

  return renderer.render(request);
}
          `.trim();

            // const require = Module.createRequire(entrypointPath);
            return {
              code,
            };
          }
        },
      },
      reactRefreshPlugin(),
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
    path: '/{any*}',
    handler: async (request, reply) => {
      try {
        const { render } = (await vite.ssrLoadModule(entrypointUrl)) as {
          render: import('./runtime/server/renderer').ServerRenderer['render'];
        };

        const res = await new Promise((resolve, reject) => {
          vite.middlewares(request.raw.req, request.raw.res, (err: Error) => {
            if (err) {
              return reject(err);
            }

            return render({
              body: '',
              headers: new Headers(request.headers as any),
              method: request.method,
              path: request.url.pathname,
            }).then(({ response }) => {
              const html = response.body as string;
              const res = reply.response(html).code(response.status);

              response.headers.forEach((value, key) => {
                res.header(key, value);
              });

              return resolve(res);
            }, reject);
          });
        }).catch((err) => {
          console.error(err);

          throw err;
        });

        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  });

  // server.route({
  //   method: 'get',
  //   path: '/{any*}',
  //   handler: async (request, reply) => {
  //     const { response } = await renderer.render({
  //       body: '',
  //       headers: new Headers(request.headers as any),
  //       method: request.method,
  //       path: request.url.pathname,
  //     });
  //     const html = response.body as string;
  //     const res = reply.response(html).code(response.status);

  //     response.headers.forEach((value, key) => {
  //       res.header(key, value);
  //     });

  //     return res;
  //   },
  // });

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
