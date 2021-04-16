export interface ChunkDependencies {
  [chunkName: string]: {
    modules: string[];
    styles: { relPath: string; css: string }[];
  };
}
