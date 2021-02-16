import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import LRUCache from 'lru-cache';
import { compileMdx } from '../../worker/mdxCompiler';

const cache = new LRUCache<string, string>({
  max: 1024 * 1024 * 32, // 32 mb
  length(value, key) {
    return value.length + (key ? key.length : 0);
  },
});

export function mdxPlugin(): Plugin {
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
        const transformed = await compileMdx(path, contents);

        cache.set(path, transformed!);

        return {
          contents: transformed,
          loader: 'jsx',
        };
      });
    },
  };
}
