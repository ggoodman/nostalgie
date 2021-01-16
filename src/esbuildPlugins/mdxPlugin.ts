import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import { pool } from 'workerpool';

const cache = new Map<string, string>();

export function mdxPlugin(_options: {} = {}): Plugin {
  return {
    name: 'mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx?$/ }, async ({ path }) => {
        const workerPool = pool(Path.resolve(__dirname, './mdxCompilerWorker.js'), {
          workerType: 'auto',
          forkOpts: {
            stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          },
        });
        const contents = await Fs.readFile(path, 'utf8');

        let transformed = cache.get(contents);

        if (!transformed) {
          transformed = await workerPool.exec('compileMdx', [path, contents]);
        }

        return {
          contents: transformed,
          loader: 'jsx',
        };
      });
    },
  };
}
