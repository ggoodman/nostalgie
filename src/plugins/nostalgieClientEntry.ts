import jsesc from 'jsesc';
import { join } from 'node:path';
import type { NostalgieConfig } from '../config';
import { invariant } from '../invariant';
import type { Plugin } from '../plugin';

export interface ClientEntryPluginOptions {
  readonly config: NostalgieConfig;
  readonly clientEntrypointUrl: string;
  readonly clientRenderPluginImports: string[];
  readonly clientRenderPluginInstantiations: string[];
}

export function nostalgieClientEntryPlugin({
  config,
  clientEntrypointUrl,
  clientRenderPluginImports,
  clientRenderPluginInstantiations,
}: ClientEntryPluginOptions): Plugin {
  const syntheticClientEntrypointPath = join(
    config.rootDir,
    clientEntrypointUrl
  );

  return {
    name: 'nostalgie-plugin-client-entry',
    resolveId(source) {
      if (source === clientEntrypointUrl) {
        return {
          id: syntheticClientEntrypointPath,
        };
      }
    },
    load(id) {
      if (id !== syntheticClientEntrypointPath) {
        return;
      }

      const appEntrypoint = config.appEntrypoint;

      invariant(appEntrypoint, 'App entrypoint is missing or falsy');

      const code = `
      import App from ${jsesc(appEntrypoint, {
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
            wrap: true,
          })},
          plugins: [${clientRenderPluginInstantiations.join(',')}]
        });
      
        return renderer.render(request);
      }`.trim();

      // const require = Module.createRequire(entrypointPath);
      return {
        code,
      };
    },
  };
}
