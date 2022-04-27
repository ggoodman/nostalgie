// import Debug from 'debug';
import type { Plugin } from '../../../plugin';

// const debug = Debug.debug('nostalgie:plugin:markup');
// const preloadMethod = `__vitePreload`

export const pluginName = 'nostalgie-plugin-markup';

export function markupPlugin(): Plugin {
  return {
    name: pluginName,
    getClientRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/markup/plugin/client',
      };
    },
    getServerRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/markup/plugin/server',
      };
    },
  };
}
