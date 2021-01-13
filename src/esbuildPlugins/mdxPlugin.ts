//@ts-ignore
import mdx from '@mdx-js/mdx';
import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import Module from 'module';
import remarkGfm from 'remark-gfm';

const createRequire = Module.createRequire || Module.createRequireFromPath;

export function mdxPlugin(_options: {} = {}): Plugin {
  return {
    name: 'mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx?$/ }, async ({ path }) => {
        const contents = await Fs.readFile(path, 'utf8');
        const require = createRequire(__filename);

        const result: string = await mdx(contents, {
          remarkPlugins: [remarkGfm],
        });
        const wrappedResult = `import { mdx } from ${JSON.stringify(
          require.resolve('@mdx-js/react/dist/esm.js')
        )};\n${result}`;

        return {
          contents: wrappedResult,
          loader: 'jsx',
        };
      });
    },
  };
}
