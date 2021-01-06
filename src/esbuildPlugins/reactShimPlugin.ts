import type { Plugin } from 'esbuild';
import Module from 'module';
import * as Path from 'path';

const createRequire = Module.createRequire || Module.createRequireFromPath;

export function reactShimPlugin(): Plugin {
  return {
    name: 'react-shim',
    setup(build) {
      // This will be relative to the dist/index.js
      const require = createRequire(__filename);
      const lazyPath = require.resolve('../runtime/browser/lazy.tsx');
      // const reactPath = require.resolve('react');

      build.onResolve({ filter: /^react$/, namespace: 'file' }, ({ resolveDir, importer }) => {
        if (importer.includes('/node_modules/') || importer.startsWith(Path.dirname(lazyPath))) {
          return;
        }

        return {
          path: resolveDir,
          namespace: 'react-shim',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'react-shim' }, async ({ path }) => {
        return {
          contents: `module.exports = { ...require('react'), lazy: require(${JSON.stringify(
            lazyPath
          )}).lazy };`,
          resolveDir: path,
        };
      });
    },
  };
}
