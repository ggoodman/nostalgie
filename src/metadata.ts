import type { Metadata } from 'esbuild';
import escapeStringRegexp from 'escape-string-regexp';
import * as Path from 'path';
import type { NostalgieSettingsReader } from './settings';

export class ClientBuildMetadata {
  private readonly _chunkDependencies = new Map<string, Set<string>>();
  private readonly _chunkInputs = new Map<string, Set<string>>();
  private readonly _inputsToChunks = new Map<string, Set<string>>();

  constructor(settings: NostalgieSettingsReader, metadata: Metadata) {
    const rootDir = settings.get('rootDir');
    const buildDir = settings.get('buildDir');
    const staticDir = settings.get('staticDir');

    // Temporary work-around for https://github.com/evanw/esbuild#662
    const chunkFixRx = new RegExp(
      `^(${escapeStringRegexp(staticDir)}\\/build)(\\/[^\\/]+)?(\\/chunk\\.\\w+\\.(?:js|mjs|cjs))$`,
      'g'
    );
    const fixChunkPath = (chunkName: string) => {
      return chunkName.replace(chunkFixRx, '$1$3');
    };

    for (const originalChunkPath in metadata.outputs) {
      const chunkOutputMeta = metadata.outputs[originalChunkPath];
      const chunkPath = Path.relative(
        buildDir,
        fixChunkPath(Path.join(rootDir, originalChunkPath))
      );

      for (const originalInputPath in chunkOutputMeta.inputs) {
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

      // No dependencies, NFWD
      if (!chunkOutputMeta.imports) {
        continue;
      }

      // Collect the normalized dependencies of this chunk
      for (const importedChunk of chunkOutputMeta.imports) {
        const importedChunkPath = Path.relative(
          buildDir,
          fixChunkPath(Path.join(rootDir, importedChunk.path))
        );

        let chunkDependencies = this._chunkDependencies.get(chunkPath);
        if (!chunkDependencies) {
          chunkDependencies = new Set();
          this._chunkDependencies.set(chunkPath, chunkDependencies);
        }
        chunkDependencies.add(importedChunkPath);
      }
    }
  }

  /**
   * A mapping of a chunk's build path to the set of other chunks' build paths it depends upon.
   */
  get chunkDependencies(): ReadonlyMap<string, Set<string>> {
    return this._chunkDependencies;
  }

  /**
   * A mapping of a chunk's build path to the set of input files' paths it contains.
   */
  get chunkInputs(): ReadonlyMap<string, Set<string>> {
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

  getChunkDependenciesObject() {
    const deps: { [chunkPath: string]: string[] } = {};

    for (const [chunkPath, chunkDependencies] of this._chunkDependencies) {
      deps[chunkPath] = [...chunkDependencies];
    }

    return deps;
  }
}