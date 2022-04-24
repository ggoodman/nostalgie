import type { RollupOutput } from 'rollup';
import { NOSTALGIE_MANIFEST_MODULE_ID } from '../../constants';
import { invariant } from '../../invariant';
import type { Plugin } from '../../plugin';

export function createManifestPlugin(clientBuild?: RollupOutput): Plugin {
  return {
    name: 'nostalgie-plugin-manifest',
    enforce: 'pre',
    resolveId(source) {
      if (source === NOSTALGIE_MANIFEST_MODULE_ID) {
        return {
          id: NOSTALGIE_MANIFEST_MODULE_ID,
        };
      }
    },
    load(id) {
      if (id === NOSTALGIE_MANIFEST_MODULE_ID) {
        if (!clientBuild) {
          // This must BE the client build so we'll produce a dummy manifest
          return {
            code: '{}',
          };
        }
        const manifestEntry = clientBuild.output.find((file) => {
          return file.type === 'asset' && file.fileName === 'manifest.json';
        });

        if (!manifestEntry) {
          return;
        }

        // Redundant check to satisfy TypeScript below
        invariant(
          manifestEntry.type === 'asset',
          'The generated manifest was not a rollup "asset"'
        );

        return {
          code: Buffer.from(manifestEntry.source).toString(),
        };
      }
    },
  };
}
