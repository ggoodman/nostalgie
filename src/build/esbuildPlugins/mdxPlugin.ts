import type { AbortSignal } from 'abort-controller';
import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import Piscina from 'piscina';

const cache = new Map<string, string>();
let workerPool: Piscina | undefined;

export function mdxPlugin(options: { signal: AbortSignal }): Plugin {
  options.signal.addEventListener('abort', () => {
    workerPool?.destroy();
  });

  return {
    name: 'mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx?$/ }, async ({ path }) => {
        workerPool ??= new Piscina({
          filename: Path.resolve(__dirname, './mdxCompilerWorker.js'),
        });

        const contents = await Fs.readFile(path, 'utf8');

        let transformed = cache.get(contents);

        if (!transformed) {
          transformed = await workerPool.runTask([path, contents]);
        }

        return {
          contents: transformed,
          loader: 'jsx',
        };
      });
    },
  };
}
