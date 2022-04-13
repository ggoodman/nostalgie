import type { Context } from '@ggoodman/context';
import reactRefreshPlugin from '@vitejs/plugin-react';
import jsesc from 'jsesc';
import * as Path from 'node:path';
import { build, InlineConfig } from 'vite';
import type { NostalgieConfig } from './config';
import { NOSTALGIE_MANIFEST_MODULE_ID } from './constants';
import { invariant } from './invariant';
import type { Logger } from './logging';

// const debug = Debug.debug('nostalgie:dev');

export async function buildProject(
  ctx: Context,
  logger: Logger,
  config: NostalgieConfig
) {
  logger.onValidConfiguration(config);

  const clientEntrypointUrl = `nostalgie.client.js`;
  const serverEntrypointUrl = `nostalgie.server.js`;
  const syntheticClientEntrypointPath = Path.join(
    config.rootDir,
    clientEntrypointUrl
  );
  const syntheticServerEntrypointPath = Path.join(
    config.rootDir,
    serverEntrypointUrl
  );
  const serverRenderPluginImports: string[] = [];
  const serverRenderPluginInstantiations: string[] = [];
  const clientRenderPluginImports: string[] = [];
  const clientRenderPluginInstantiations: string[] = [];

  // TODO: This should be configurable
  // const urlPrefix = '/static';

  // const appEntryUrl = `${urlPrefix}/static/app.es.js`;

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

  const appEntrypoint = config.settings.appEntrypoint;

  invariant(appEntrypoint, 'App entrypoint is missing or falsy');

  const viteConfig: InlineConfig = {
    root: config.rootDir,
    configFile: false,
    mode: 'production',
    clearScreen: false,
    logLevel: 'info',
    plugins: [
      {
        name: 'nostalgie',
        resolveId(source, importer, options) {
          if (source === clientEntrypointUrl) {
            return {
              id: syntheticClientEntrypointPath,
            };
          }
          if (source === serverEntrypointUrl) {
            return {
              id: syntheticServerEntrypointPath,
            };
          }
          if (source === NOSTALGIE_MANIFEST_MODULE_ID) {
            return {
              id: Path.resolve(config.rootDir, './out/manifest.json'),
            };
          }
        },
        load(id, ssr) {
          if (id === syntheticClientEntrypointPath) {
            const entrypointPath = Path.resolve(config.rootDir, appEntrypoint);
            const code = `
import App from ${jsesc(entrypointPath, {
              isScriptContext: true,
              json: true,
            })};
import { ClientRenderer } from "nostalgie/runtime/client";
${clientRenderPluginImports.join('\n')}

export function render(request) {
  const renderer = new ClientRenderer({
    appRoot: App,
    entrypointUrl: ${jsesc(clientEntrypointUrl, {
      isScriptContext: true,
      json: true,
    })},
    plugins: [${clientRenderPluginInstantiations.join(',')}]
  });

  return renderer.render(request);
}
          `.trim();

            return {
              code,
            };
          } else if (id === syntheticServerEntrypointPath) {
            const entrypointPath = Path.resolve(config.rootDir, appEntrypoint);
            const code = `
              import App from ${jsesc(entrypointPath, {
                isScriptContext: true,
                json: true,
              })};
              import manifest from "${NOSTALGIE_MANIFEST_MODULE_ID}";
              import { ServerRenderer, ViteAssetManifest } from "nostalgie/runtime/server";
              ${serverRenderPluginImports.join('\n')}
              
              const renderer = new ServerRenderer({
                appRoot: App,
                assetManifest: new ViteAssetManifest(manifest),
                entrypointUrl: ${jsesc(clientEntrypointUrl, {
                  isScriptContext: true,
                  json: true,
                })},
                publicUrl: 'https://localhost:3000/',
                plugins: [${serverRenderPluginInstantiations.join(',')}]
              });

              export function render(request) {
              
                return renderer.render(request);
              }`.trim();
            return {
              code,
            };
          }
        },
      },
      reactRefreshPlugin(),
      ...(config.settings.plugins || []),
    ],
  };

  await build({
    ...viteConfig,
    build: {
      target: 'modules',
      rollupOptions: {
        input: [clientEntrypointUrl],
        output: {
          exports: 'named',
        },
        preserveEntrySignatures: 'strict',
      },
      outDir: './out',
      polyfillModulePreload: false,

      emptyOutDir: true,
      cssCodeSplit: true,
      minify: false,
      manifest: true,
      ssr: false,
    },
    optimizeDeps: {
      entries: [clientEntrypointUrl, appEntrypoint],
    },
  });

  await build({
    ...viteConfig,
    build: {
      target: 'node16',

      rollupOptions: {
        input: [serverEntrypointUrl],
      },
      outDir: './out',

      polyfillModulePreload: false,
      emptyOutDir: false,
      cssCodeSplit: false,
      minify: false,
      manifest: false,
      assetsDir: '',

      ssr: true,
    },
    optimizeDeps: {
      entries: [serverEntrypointUrl, appEntrypoint],
    },
  });
}
