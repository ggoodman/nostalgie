import type { Plugin } from 'esbuild';
import Module from 'module';
import * as Path from 'path';
import type { NostalgieSettingsReader } from 'src/settings';

const createRequire = Module.createRequire || Module.createRequireFromPath;

export function reactShimPlugin(settings: NostalgieSettingsReader): Plugin {
  return {
    name: 'react-shim',
    setup(build) {
      // This will be relative to the dist/index.js
      const require = createRequire(__filename);
      const lazyPath = require.resolve('../runtime/browser/lazy.ts');
      const reactPath = require.resolve('react');
      const reactShimPath = Path.resolve(reactPath, '../react-nostalgie.js');

      build.onResolve({ filter: /^react$/, namespace: 'file' }, ({ importer }) => {
        if (importer === lazyPath || importer.match(/\/node_modules\//)) {
          return;
        }

        return {
          path: reactShimPath,
          namespace: 'react-shim',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'react-shim' }, async ({ path }) => {
        return {
          contents: `
const React = require('react');
module.exports = Object.assign(React, {
  Suspense: process.env.NOSTALGIE_BUILD_TARGET === 'browser' ? React.Suspense : (props) => React.Children.only(props.children),
  lazy: require(${JSON.stringify(lazyPath)}).createLazy(React),
});
                `,
          resolveDir: Path.dirname(reactPath),
        };
      });
    },
  };
}
