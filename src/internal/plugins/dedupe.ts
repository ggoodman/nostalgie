import type { Plugin } from '../../plugin';

export function createDedupePlugin(): Plugin {
  return {
    name: 'nostalgie-plugin-dedupe',
    enforce: 'pre',
    config(config) {
      // See: https://vitejs.dev/config/#ssr-options
      (config as any).ssr ??= {};
      (config as any).ssr.noExternal ??= [];
      (config as any).ssr.noExternal.push('react');
      (config as any).ssr.noExternal.push('react-dom');
    },
  };
}
