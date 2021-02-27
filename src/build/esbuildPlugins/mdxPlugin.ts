import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import LRUCache from 'lru-cache';
import type { CancellationToken } from 'ts-primitives';
import { compileMdx } from '../../worker/mdxCompiler';

const cache = new LRUCache<string, string>({
  max: 1024 * 1024 * 32, // 32 mb
  length(value, key) {
    return value.length + (key ? key.length : 0);
  },
});

export function mdxPlugin(_options: { token: CancellationToken }): Plugin {
  return {
    name: 'mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx?$/ }, async ({ path }) => {
        const cached = cache.get(path);

        if (cached) {
          return {
            contents: cached,
            loader: 'jsx',
          };
        }

        const contents = await Fs.readFile(path, 'utf8');

        // watcher ??= watch([], { ignoreInitial: true, usePolling: true, interval: 16 });
        // watcher.on('all', (_eventType, path) => {
        //   if (typeof path === 'string') {
        //     cache.del(path);
        //     watcher?.unwatch(path);
        //   }
        // });

        // workerPool ??= new Piscina({
        //   filename: Path.resolve(__dirname, './mdxCompilerWorker.js'),
        // });

        // const transformed = await workerPool.runTask([path, contents.trim()]);
        const { contents: transformed, errors, warnings } = await compileMdx(path, contents);

        cache.set(path, transformed as string);
        // watcher.add(path);

        return {
          contents: transformed,
          errors,
          warnings,
          loader: 'jsx',
        };
      });
    },
  };
}
