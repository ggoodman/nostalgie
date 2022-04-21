import jsesc from 'jsesc';
import { join } from 'node:path';
import type { NostalgieConfig } from '../config';
import { NOSTALGIE_MANIFEST_MODULE_ID } from '../constants';
import { invariant } from '../invariant';
import type { Plugin } from '../plugin';

export interface ServerEntryPluginOptions {
  readonly config: NostalgieConfig;
  readonly clientEntrypointUrl: string;
  readonly serverEntrypointUrl: string;
  readonly serverRenderPluginImports: string[];
  readonly serverRenderPluginInstantiations: string[];
}

export function nostalgieServerEntryPlugin({
  config,
  clientEntrypointUrl,
  serverEntrypointUrl,
  serverRenderPluginImports,
  serverRenderPluginInstantiations,
}: ServerEntryPluginOptions): Plugin {
  const syntheticServerEntrypointPath = join(
    config.rootDir,
    serverEntrypointUrl
  );

  return {
    name: 'nostalgie-plugin-server-entry',
    resolveId(source) {
      if (source === serverEntrypointUrl) {
        return {
          id: syntheticServerEntrypointPath,
        };
      }
    },
    load(id) {
      if (id !== syntheticServerEntrypointPath) {
        return;
      }

      const appEntrypoint = config.settings.appEntrypoint;

      invariant(appEntrypoint, 'App entrypoint is missing or falsy');

      const code = `
        import App from ${jsesc(appEntrypoint, {
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

      // const require = Module.createRequire(entrypointPath);
      return {
        code,
      };
    },
  };
}
