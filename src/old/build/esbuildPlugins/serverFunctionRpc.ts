import type { Plugin } from 'esbuild';
import escapeStringRegExp from 'escape-string-regexp';

export function serverFunctionProxyPlugin(
  resolveExtensions: string[],
  functionsPath: string,
  functionNames: string[]
): Plugin {
  return {
    name: 'server-function-rpc',
    setup(build) {
      build.onLoad(
        {
          filter: new RegExp(
            `^${escapeStringRegExp(functionsPath)}(${resolveExtensions
              .map(escapeStringRegExp)
              .join('|')})$`,
            'g'
          ),
          namespace: 'file',
        },
        () => {
          return {
            contents:
              functionNames.map((name) => `export const ${name} = (name, args) => `).join('\n') +
              '\n',
          };
        }
      );
    },
  };
}
