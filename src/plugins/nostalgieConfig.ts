import type { NostalgieConfig } from '../config';
import type { Plugin } from '../plugin';

/**
 * Internal plugin to call the `nostalgieConfig` and
 * `nostalgieConfigResolved` plugin hooks.
 */
export function nostalgieConfigPlugin(config: NostalgieConfig): Plugin {
  return {
    name: 'nostalgie-plugin-config',
    enforce: 'pre',
    async config(viteConfig) {
      if (!Array.isArray(viteConfig.plugins)) {
        return;
      }

      for (const plugin of viteConfig.plugins) {
        const configFn = (plugin as Plugin).nostalgieConfig;

        if (typeof configFn === 'function') {
          await configFn(viteConfig, config);
        }
      }
    },
    async configResolved(viteConfig) {
      for (const plugin of viteConfig.plugins) {
        const configResolvedFn = (plugin as Plugin).nostalgieConfigResolved;

        if (typeof configResolvedFn === 'function') {
          await configResolvedFn(config);
        }
      }
    },
  };
}
