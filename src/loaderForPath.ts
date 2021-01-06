import type { Loader } from 'esbuild';
import * as Path from 'path';

export function loaderForPath(path: string): Loader {
  const ext = Path.extname(path);
  const slicedExt = ext.slice(1);

  switch (slicedExt) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'css':
    case 'json':
      return slicedExt;
    case 'md':
      return 'text';
    case 'ico':
      return 'file';
  }

  throw new Error(`Invariant violation: Unsupported extension ${JSON.stringify(ext)}`);
}
