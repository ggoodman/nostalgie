import type { Manifest } from 'vite';

export interface AssetManifest {
  translatePath(srcPath: string): string;
}

export class NoopAssetManifest implements AssetManifest {
  translatePath(srcPath: string): string {
    return srcPath.startsWith('/') ? srcPath : `/${srcPath}`;
  }
}

export class ViteAssetManifest implements AssetManifest {
  constructor(private readonly manifest: Manifest) {}
  translatePath(srcPath: string): string {
    const manifestEntry = this.manifest[srcPath];

    if (!manifestEntry) {
      throw new Error(`Unable to find manifest for ${srcPath}`);
    }

    return `/${manifestEntry.file}`;
  }
}
