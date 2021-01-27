import type { Metadata } from 'esbuild';
import * as Path from 'path';
import type { NostalgieSettings } from '../settings';
import type { ChunkDependencies } from './types';

export class ClientBuildMetadata {
  private readonly _chunkDependencies = new Map<
    string,
    { styles: Map<string, string>; modules: Set<string> }
  >();
  private readonly _chunkInputs = new Map<string, Set<string>>();
  private readonly _inputsToChunks = new Map<string, Set<string>>();

  constructor(
    settings: NostalgieSettings,
    metadata: Metadata,
    readonly cssMap: Map<string, string>
  ) {
    const rootDir = settings.rootDir;
    const buildDir = settings.buildDir;

    for (const originalChunkPath in metadata.outputs) {
      const chunkOutputMeta = metadata.outputs[originalChunkPath];
      const chunkPath = Path.relative(buildDir, Path.join(rootDir, originalChunkPath));
      const chunkStyles = new Map<string, string>();

      for (const originalInputPath in chunkOutputMeta.inputs) {
        const css = cssMap.get(originalInputPath);
        if (css) {
          chunkStyles.set(originalInputPath, css);
        }

        const inputPath = Path.resolve(rootDir, originalInputPath);

        let chunkInputs = this._chunkInputs.get(chunkPath);
        if (!chunkInputs) {
          chunkInputs = new Set();
          this._chunkInputs.set(chunkPath, chunkInputs);
        }
        chunkInputs.add(inputPath);

        let inputChunks = this._inputsToChunks.get(inputPath);
        if (!inputChunks) {
          inputChunks = new Set();
          this._inputsToChunks.set(inputPath, inputChunks);
        }
        inputChunks.add(chunkPath);
      }

      // We have some css files as dependencies, make sure to set them up
      if (chunkStyles.size) {
        let chunkDependencies = this._chunkDependencies.get(chunkPath);
        if (!chunkDependencies) {
          chunkDependencies = { styles: new Map(), modules: new Set() };
          this._chunkDependencies.set(chunkPath, chunkDependencies);
        }
        for (const [relPath, css] of chunkStyles) {
          chunkDependencies.styles.set(relPath, css);
        }
      }

      // No dependencies, NFWD
      if (!chunkOutputMeta.imports) {
        continue;
      }

      // Collect the normalized dependencies of this chunk
      for (const importedChunk of chunkOutputMeta.imports) {
        if (importedChunk.kind !== 'dynamic-import') {
          const importedChunkPath =
            '/' + Path.relative(buildDir, Path.join(rootDir, importedChunk.path));

          let chunkDependencies = this._chunkDependencies.get(chunkPath);
          if (!chunkDependencies) {
            chunkDependencies = { styles: new Map(), modules: new Set() };
            this._chunkDependencies.set(chunkPath, chunkDependencies);
          }
          chunkDependencies.modules.add(importedChunkPath);
        }
      }
    }
  }

  /**
   * A mapping of a chunk's build path to the set of other chunks' build paths it depends upon.
   */
  get chunkDependencies(): ReadonlyMap<
    string,
    { readonly modules: ReadonlySet<string>; readonly styles: ReadonlyMap<string, string> }
  > {
    return this._chunkDependencies;
  }

  /**
   * A mapping of a chunk's build path to the set of input files' paths it contains.
   */
  get chunkInputs(): ReadonlyMap<string, ReadonlySet<string>> {
    return this._chunkInputs;
  }

  getChunksForInput(path: string, resolveExtensions: string[]) {
    const chunks = this._inputsToChunks.get(path);

    if (chunks) {
      return { chunks, path };
    }

    for (const ext of resolveExtensions) {
      const pathWithExt = `${path}${ext}`;
      const chunks = this._inputsToChunks.get(pathWithExt);

      if (chunks) {
        return { chunks, path: pathWithExt };
      }
    }
  }

  getChunkDependenciesObject(): ChunkDependencies {
    const deps: ChunkDependencies = {};

    for (const [chunkPath, { modules, styles }] of this._chunkDependencies) {
      deps[chunkPath] = {
        modules: [...modules],
        styles: Array.from(styles.keys()).map((relPath) => ({
          relPath,
          css: styles.get(relPath)!,
        })),
      };
    }

    return deps;
  }
}
