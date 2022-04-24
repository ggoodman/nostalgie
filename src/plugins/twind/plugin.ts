import * as colors from 'twind/colors';
import type { Plugin } from '../../plugin';
import type { TwindPluginOptions } from './options';

export function twindPlugin(options: TwindPluginOptions = {}): Plugin {
  options.twindConfig ??= {
    preflight: true,
    theme: { extend: { colors } },
  };

  return {
    name: 'twind-plugin',
    getClientRendererPlugins() {
      return {
        config: options,
        spec: options.shimHtml
          ? 'nostalgie/twind/plugin/shim/client'
          : 'nostalgie/twind/plugin/client',
      };
    },
    getServerRendererPlugins() {
      return {
        config: options,
        spec: options.shimHtml
          ? 'nostalgie/twind/plugin/shim/server'
          : 'nostalgie/twind/plugin/server',
      };
    },
  };
}
