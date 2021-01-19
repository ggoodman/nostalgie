import type { Loader } from 'esbuild';

export const defaultResolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export const loaders: {
  [ext: string]: Loader;
} = {
  '.css': 'file',
  '.ico': 'file',
  '.png': 'file',
  '.svg': 'file',
};
