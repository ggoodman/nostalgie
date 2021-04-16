import { createRequire } from 'node:module';

/** @returns {import('../src/plugin').Plugin} */
export function createPlugin() {
  const require = createRequire(__filename || new URL(import.meta.url).pathname);

  return {
    name: 'testplugin',
    getClientRendererPlugins() {
      return [
        {
          spec: require.resolve('./clientPlugin'),
        },
      ];
    },
  };
}
