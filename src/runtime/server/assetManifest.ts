import type { Manifest } from 'vite';

export interface AssetManifest {
  listDependencies(srcPath: string): string[];
  translatePath(srcPath: string): string;
}

export class ViteAssetManifest implements AssetManifest {
  constructor(private readonly manifest: Manifest) {}

  private traverseDependencies(srcPath: string, dependencies: string[]): void {
    const manifestEntry = this.manifest[srcPath];

    if (!manifestEntry) {
      throw new Error(`Unable to find manifest for ${srcPath}`);
    }

    if (Array.isArray(manifestEntry.imports)) {
      for (const importPath of manifestEntry.imports) {
        this.traverseDependencies(importPath, dependencies);
      }
    }

    dependencies.push(manifestEntry.file);
  }

  listDependencies(srcPath: string): string[] {
    if (import.meta.env.DEV && import.meta.env.SSR) {
      return [];
    }

    const dependencies: string[] = [];

    this.traverseDependencies(srcPath, dependencies);

    return dependencies;
  }

  translatePath(srcPath: string): string {
    if (import.meta.env.DEV && import.meta.env.SSR) {
      return srcPath.startsWith('/') ? srcPath : `/${srcPath}`;
    }

    const manifestEntry = this.manifest[srcPath];

    if (!manifestEntry) {
      throw new Error(`Unable to find manifest for ${srcPath}`);
    }

    return `/${manifestEntry.file}`;
  }
}
