import type { Plugin } from 'esbuild';
import escapeStringRegexp from 'escape-string-regexp';

export function externalizePlugin(specifier: string, asSpecifier: string): Plugin {
  const filter = new RegExp(`^${escapeStringRegexp(specifier)}$`, 'g');
  let nextIndex = 0;

  return {
    name: 'externalize-plugin',
    setup(build) {
      const nonce = `__externalize_${nextIndex++}__`;

      build.onResolve(
        { filter: new RegExp(`^${escapeStringRegexp(nonce)}$`, 'g'), namespace: 'file' },
        (arg) => {
          return {
            path: asSpecifier,
            external: true,
            namespace: 'externalize-plugin',
          };
        }
      );

      build.onLoad({ filter, namespace: 'file' }, (arg) => {
        return {
          contents: `module.exports = require(${JSON.stringify(nonce)});`,
        };
      });
    },
  };
}
