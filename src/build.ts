import reactRefreshPlugin from '@vitejs/plugin-react';
import jsesc from 'jsesc';
import * as Path from 'path';
import { build, InlineConfig, LibraryOptions } from 'vite';
import type { NostalgieConfig } from './config';
import type { Context } from './context';
import type { Logger } from './logging';

// const debug = Debug.debug('nostalgie:dev');

export async function buildProject(
  ctx: Context,
  logger: Logger,
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

  const viteConfig: InlineConfig = {
    root: config.rootDir,
    configFile: false,
    build: {
      rollupOptions: {
        input: [entrypointUrl],
      },
      // lib: {
      //   entry: entrypointUrl,
      //   formats: ['es'],
      // },
      emptyOutDir: true,
      cssCodeSplit: true,
      minify: false,
      ssrManifest: true,
      outDir: './out/static',
      target: 'esnext',
      write: true,
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
        },
        load(id, ssr) {
          if (id === syntheticEntrypointPath) {
            const entrypointPath = Path.resolve(
              config.rootDir,
              config.settings.appEntrypoint!
            );
            const code = ssr
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
  };

  await build(viteConfig);
  await build({
    ...viteConfig,
    build: {
      ...viteConfig.build,
      lib: {
        entry: entrypointUrl,
        formats: ['cjs'],
      } as LibraryOptions,
      outDir: './out/ssr',
      ssr: true,
    },
  });
}
