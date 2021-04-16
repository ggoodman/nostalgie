import type { Plugin } from '../../../plugin';

export function twindPlugin(): Plugin {
  return {
    name: 'twind-plugin',
    getClientRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/plugins/twind/client',
      };
    },
    getServerRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/plugins/twind/server',
      };
    },
  };
}
