import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { Logger } from 'pino';
import { loaderForPath } from '../loaderForPath';
import type { ClientBuildMetadata } from '../metadata';
import type { LazyFactoryMeta } from '../runtime/lazy/types';

export function decorateDeferredImportsServerPlugin(options: {
  buildDir: string;
  clientBuildMetadata: ClientBuildMetadata;
  logger: Logger;
  relativePath: string;
  resolveExtensions: string[];
  rootDir: string;
}): Plugin {
  const name = 'import-meta';

  const clientBuildMetadata = options.clientBuildMetadata;
  const logger = options.logger;
  const resolveExtensions = options.resolveExtensions;
  const rootDir = options.rootDir;

  const rx = /\(\)\s*=>\s*import\(\s*(['"])([^)]+)\1\s*\)/gm;

  return {
    name: name,
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: 'file' }, async ({ path }) => {
        if (/\/node_modules\//.test(path)) {
          return;
        }

        const contents = await Fs.readFile(path, 'utf8');
        let foundMatch = false;

        const transformedContent = contents.replace(
          rx,
          (match: string, _quote: string, spec: string) => {
            const absoluteSpec = Path.resolve(Path.dirname(path), spec);
            const normalizedSpec = Path.relative(rootDir, absoluteSpec);

            const chunkPathsForSpec = clientBuildMetadata.getChunksForInput(
              absoluteSpec,
              resolveExtensions
            );

            if (!chunkPathsForSpec) {
              logger.warn(
                { path: Path.relative(rootDir, absoluteSpec), resolveExtensions },
                'Unable to identify the output chunk for a deferred import'
              );
              return match;
            }

            const { path: resolvedPath, chunks } = chunkPathsForSpec;

            if (!chunks.size) {
              logger.warn(
                {
                  chunks: [...chunks],
                  path: resolvedPath,
                },
                'Found no chunks for the input path when expecting exactly 1'
              );
              return match;
            }

            const chunk = [...chunks][0];

            if (chunks.size > 1) {
              logger.warn(
                {
                  chunk,
                  chunks: [...chunks],
                  path: resolvedPath,
                },
                'Found multiple chunks for the input path when expecting exactly 1, using the first one'
              );
            }

            foundMatch = true;

            const lazyFactoryMeta: LazyFactoryMeta = {
              chunk,
              lazyImport: normalizedSpec,
              sync: true,
            };

            return `Object.assign(() => require(${JSON.stringify(spec)}), ${JSON.stringify(
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
      });
    },
  };
}
