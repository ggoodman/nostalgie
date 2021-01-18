import type { Plugin } from 'esbuild';
import * as Path from 'path';
import { createRequire } from '../../createRequire';
import type { NostalgieSettings } from '../../settings';

export function reactShimPlugin(settings: NostalgieSettings): Plugin {
  return {
    name: 'react-shim',
    setup(build) {
      // This will be relative to the dist/index.js
      const appRequire = createRequire(Path.join(settings.buildDir, 'index.js'));
      const lazyPath = appRequire.resolve('nostalgie/lazy');
      const reactPath = appRequire.resolve('react');
      const reactShimPath = Path.resolve(reactPath, '../react-nostalgie.js');

      build.onResolve({ filter: /^react$/, namespace: 'file' }, ({ importer }) => {
        if (importer === lazyPath) {
          return {
            path: reactPath,
            namespace: 'file',
          };
        }

        return {
          path: reactShimPath,
          namespace: 'react-shim',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'react-shim' }, async () => {
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
