import type { Plugin } from 'esbuild';
import * as Path from 'path';

export function resolveNostalgiePlugin(): Plugin {
  return {
    name: 'resolve-nostalgie',
    setup(build) {
      build.onResolve({ filter: /^nostalgie$/ }, () => {
        return {
          path: Path.resolve(__dirname, '../runtime/browser/index.ts'),
        };
      });

      build.onResolve({ filter: /^nostalgie\/internals$/ }, () => {
        return {
          path: Path.resolve(__dirname, '../runtime/browser/internals.ts'),
        };
      });
    },
  };
}
