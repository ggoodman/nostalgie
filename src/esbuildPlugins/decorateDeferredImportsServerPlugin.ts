import type { Metadata, Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import { loaderForPath } from '../loaderForPath';

export function decorateDeferredImportsServerPlugin(options: {
  buildDir: string;
  clientBuildMetadata: Metadata;
  resolveExtensions: string[];
  rootDir: string;
}): Plugin {
  const name = 'import-meta';

  const chunkByFile = new Map();

  for (const chunkName in options.clientBuildMetadata.outputs) {
    const chunk = options.clientBuildMetadata.outputs[chunkName];

    for (const inputName in chunk.inputs) {
      const inputPath = Path.resolve(process.cwd(), inputName);

      if (chunkByFile.has(inputPath)) {
        continue;
      }

      chunkByFile.set(inputPath, Path.relative(options.buildDir, chunkName));
    }
  }

  return {
    name: name,
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: 'file' }, async ({ path }) => {
        if (/\/node_modules\//.test(path)) {
          return;
        }

        let contents = await Fs.readFile(path, 'utf8');

        return {
          loader: loaderForPath(path),
          contents: contents.replace(
            /\(\)\s*=>\s*import\(\s*(['"])([^)]+)\1\s*\)/gm,
            (match: string, _quote: string, spec: string) => {
              const importerPath = Path.relative(process.cwd(), path);
              const input = options.clientBuildMetadata.inputs[importerPath];
              const lazyImport = Path.resolve(Path.dirname(path), spec);

              const resolvedEntry = input.imports.find((entry) => {
                const entryPath = Path.resolve(process.cwd(), entry.path);

                if (entryPath === lazyImport) {
                  return true;
                }

                for (const ext of options.resolveExtensions) {
                  if (entryPath === `${lazyImport}${ext}`) {
                    return true;
                  }
                }

                return false;
              });

              if (!resolvedEntry) {
                return match;
              }

              const chunk = chunkByFile.get(Path.resolve(process.cwd(), resolvedEntry.path));

              if (!chunk) {
                return match;
              }

              return `Object.assign(() => import(${JSON.stringify(
                spec
              )}), { chunk: ${JSON.stringify(chunk)}, lazyImport: ${JSON.stringify(
                Path.relative(options.rootDir, lazyImport)
              )} })`;
            }
          ),
        };
      });
    },
  };
}
