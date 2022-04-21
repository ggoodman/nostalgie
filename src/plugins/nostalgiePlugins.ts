import jsesc from 'jsesc';
import type { Plugin } from '../plugin';

export interface PluginsPluginOptions {
  readonly serverRenderPluginImports: string[];
  readonly serverRenderPluginInstantiations: string[];
  readonly clientRenderPluginImports: string[];
  readonly clientRenderPluginInstantiations: string[];
}

/**
 * Internal plugin that sets up the universal Nostalgie plugins via
 * code generation.
 */
export function nostalgiePluginsPlugin(options: PluginsPluginOptions): Plugin {
  const serverRenderPluginImports = options.serverRenderPluginImports;
  const serverRenderPluginInstantiations =
    options.serverRenderPluginInstantiations;
  const clientRenderPluginImports = options.clientRenderPluginImports;
  const clientRenderPluginInstantiations =
    options.clientRenderPluginInstantiations;

  return {
    name: 'nostalgie-plugin-plugins',
    enforce: 'post',
    nostalgieConfigResolved(config) {
      serverRenderPluginImports.length = 0;
      serverRenderPluginInstantiations.length = 0;
      clientRenderPluginImports.length = 0;
      clientRenderPluginInstantiations.length = 0;

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
    },
  };
}
