import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import { createRequire } from '../../createRequire';

export function markdownPlugin(entryPoint: string): Plugin {
  return {
    name: 'markdown',
    setup(build) {
      build.onLoad({ filter: /\.md$/ }, async ({ path }) => {
        const content = await Fs.readFile(path, 'utf8');
        const appRequire = createRequire(entryPoint);
        const require = createRequire(__filename);

        return {
          contents: `
            import * as React from ${JSON.stringify(appRequire.resolve('react'))};
            import Markdown from ${JSON.stringify(require.resolve('markdown-to-jsx'))};

            export const text = ${JSON.stringify(content)};

            export default function Component(props = {}) {
              return <Markdown {...props}>{text}</Markdown>;
            }
          `,
          loader: 'jsx',
        };
      });
    },
  };
}
