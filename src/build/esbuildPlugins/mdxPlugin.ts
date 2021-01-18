import type { AbortSignal } from 'abort-controller';
import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import { pool, WorkerPool } from 'workerpool';

const cache = new Map<string, string>();
let workerPool: WorkerPool | undefined;

export function mdxPlugin(options: { signal: AbortSignal }): Plugin {
  options.signal.addEventListener('abort', () => {
    try {
      workerPool?.terminate().catch(() => {
        // Swallow these errors with workerpool's shutdown race conditions
      });
    } catch {
      // Swallow sync errors too
    }
  });

  return {
    name: 'mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx?$/ }, async ({ path }) => {
        workerPool ??= pool(Path.resolve(__dirname, './mdxCompilerWorker.js'), {
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
