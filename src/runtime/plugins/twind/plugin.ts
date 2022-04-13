import type { Configuration } from 'twind';
import * as colors from 'twind/colors';
import type { Plugin } from '../../../plugin';

export function twindPlugin(options?: Configuration): Plugin {
  const config: Configuration = options ?? {
    preflight: true,
    theme: { extend: { colors } },
  };
  return {
    name: 'twind-plugin',
    getClientRendererPlugins() {
      return {
        config,
        spec: 'nostalgie/plugins/twind/client',
      };
    },
    getServerRendererPlugins() {
      return {
        config,
        spec: 'nostalgie/plugins/twind/server',
      };
    },
  };
}
