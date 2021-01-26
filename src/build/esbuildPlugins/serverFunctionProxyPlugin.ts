import type { Plugin } from 'esbuild';
import escapeStringRegExp from 'escape-string-regexp';

export function serverFunctionProxyPlugin(options: {
  functionsPath: string;
  functionNames: string[];
}): Plugin {
  return {
    name: 'server-function-proxy',
    setup(build) {
      build.onLoad(
        {
          filter: new RegExp(`^${escapeStringRegExp(options.functionsPath)}$`, 'g'),
          namespace: 'file',
        },
        ({ path, namespace }) => {
          return {
            contents:
              options.functionNames
                .map((name) => `export const ${name} = ${JSON.stringify({ name })}`)
                .join('\n') + '\n',
          };
        }
      );
    },
  };
}
