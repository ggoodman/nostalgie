import type { Plugin } from 'esbuild';
import escapeStringRegexp from 'escape-string-regexp';
import * as Path from 'path';

export function resolvePlugin(specifier: string, entryPoint: string): Plugin {
  const filter = new RegExp(`^${escapeStringRegexp(specifier)}$`, 'g');

  return {
    name: 'resolve-plugin',
    setup(build) {
      build.onResolve({ filter, namespace: 'file' }, ({ path }) => {
        return {
          path,
          namespace: 'nostalgie-entrypoint',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'nostalgie-entrypoint' }, () => {
        return {
          contents: `
          import defaultImport from ${JSON.stringify(
            `./${Path.relative(process.cwd(), entryPoint)}`
          )};
          export * from ${JSON.stringify(`./${Path.relative(process.cwd(), entryPoint)}`)};
          export default defaultImport;`,
          resolveDir: process.cwd(),
        };
      });
    },
  };
}
