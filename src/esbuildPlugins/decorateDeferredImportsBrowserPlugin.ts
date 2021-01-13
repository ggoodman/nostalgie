import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { LazyFactoryMeta } from 'runtime/browser/lazy';
import { loaderForPath } from '../loaderForPath';

export function decorateDeferredImportsBrowserPlugin(options: { rootDir: string }): Plugin {
  const name = 'decorate-deferred-imports-browser-plugin';

  const rootDir = options.rootDir;

  const rx = /\(\)\s*=>\s*import\(\s*(['"])([^)]+)\1\s*\)/gm;

  return {
    name,
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: 'file' }, async ({ path }) => {
        if (/\/node_modules\//.test(path)) {
          return;
        }

        const contents = await Fs.readFile(path, 'utf8');
        let foundMatch = false;

        const transformedContent = contents.replace(
          rx,
          (_match: string, _quote: string, spec: string) => {
            const absoluteSpec = Path.resolve(Path.dirname(path), spec);
            const normalizedSpec = Path.relative(rootDir, absoluteSpec);

            foundMatch = true;

            const lazyFactoryMeta: LazyFactoryMeta = {
              lazyImport: normalizedSpec,
            };

            return `Object.assign(() => import(${JSON.stringify(spec)}), ${JSON.stringify(
              lazyFactoryMeta
            )})`;
          }
        );

        if (!foundMatch) {
          return;
        }

        return {
          loader: loaderForPath(path),
          contents: transformedContent,
        };

        // return {
        //   loader: loaderForPath(path),
        //   contents: contents.replace(rx, (_match: string, _quote: string, spec: string) => {
        //     const lazyImport = Path.resolve(Path.dirname(path), spec);
        //     const lazyFactoryMeta: LazyFactoryMeta = {
        //       lazyImport: Path.relative(options.rootDir, lazyImport),
        //     };

        //     return `Object.assign(() => import(${JSON.stringify(spec)}), ${JSON.stringify(
        //       lazyFactoryMeta
        //     )})`;
        //   }),
        // };
      });
    },
  };
}
