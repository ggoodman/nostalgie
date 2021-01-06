import type { Plugin } from 'esbuild';
import * as Path from 'path';

export function resolveAppEntryPointPlugin(entryPoint: string): Plugin {
  return {
    name: 'resolve-app-entry-point',
    setup(build) {
      build.onResolve({ filter: /^__nostalgie_app__$/, namespace: 'file' }, ({ path }) => {
        return {
          path,
          namespace: 'nostalgie-entrypoint',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'nostalgie-entrypoint' }, () => {
        return {
          contents: `module.exports = require(${JSON.stringify(
            `./${Path.relative(process.cwd(), entryPoint)}`
          )});`,
          resolveDir: process.cwd(),
        };
      });
    },
  };
}
