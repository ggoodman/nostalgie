import type { Plugin } from 'esbuild';

export function bareModuleExternalPlugin(): Plugin {
  return {
    name: 'bare-module-external',
    setup(build) {
      build.onResolve({ filter: /^[^/.]/, namespace: 'file' }, async () => {
        return {
          external: true,
        };
      });
    },
  };
}
