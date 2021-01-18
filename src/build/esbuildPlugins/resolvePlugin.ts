import type { Plugin } from 'esbuild';
import escapeStringRegexp from 'escape-string-regexp';
import * as Path from 'path';

export function resolvePlugin(
  rootDir: string,
  specifier: string,
  entryPoint: string,
  exportTypes: Array<'default' | '*'>
): Plugin {
  const filter = new RegExp(`^${escapeStringRegexp(specifier)}$`, 'g');

  return {
    name: 'resolve-plugin',
    setup(build) {
      let reExportCode = '';

      if (exportTypes.includes('*')) {
        reExportCode += `
          export * from ${JSON.stringify(`./${Path.relative(rootDir, entryPoint)}`)};
        `;
      }

      if (exportTypes.includes('default')) {
        reExportCode += `
          import defaultExport from ${JSON.stringify(`./${Path.relative(rootDir, entryPoint)}`)};
          export default defaultExport; 
        `;
      }

      build.onResolve({ filter, namespace: 'file' }, ({ path }) => {
        return {
          path,
          namespace: specifier,
        };
      });

      build.onLoad({ filter: /.*/, namespace: specifier }, () => {
        return {
          contents: reExportCode,
          resolveDir: rootDir,
        };
      });
    },
  };
}
