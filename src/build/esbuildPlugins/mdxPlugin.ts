import { watch } from 'chokidar';
import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import LRUCache from 'lru-cache';
import * as Path from 'path';
import Piscina from 'piscina';
import type { CancellationToken } from 'ts-primitives';

const cache = new LRUCache<string, string>({
  max: 1024 * 1024 * 32, // 32 mb
  length(value, key) {
    return value.length + (key ? key.length : 0);
  },
});
let workerPool: Piscina | undefined;
let watcher: ReturnType<typeof watch> | undefined;

export function mdxPlugin(options: { token: CancellationToken }): Plugin {
  options.token.onCancellationRequested(() => {
    workerPool?.destroy();
    workerPool = undefined;

    watcher?.close();
    watcher = undefined;
  });

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

        watcher ??= watch([], { ignoreInitial: true });
        watcher.on('all', (_eventType, path) => {
          if (typeof path === 'string') {
            cache.del(path);
            watcher?.unwatch(path);
          }
        });

        workerPool ??= new Piscina({
          filename: Path.resolve(__dirname, './mdxCompilerWorker.js'),
        });

        const transformed = await workerPool.runTask([path, contents]);

        cache.set(path, transformed!);
        watcher.add(path);

        return {
          contents: transformed,
          loader: 'jsx',
        };
      });
    },
  };
}
