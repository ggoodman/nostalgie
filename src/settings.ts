import type { Loader } from 'esbuild';
import * as Path from 'path';

export interface NostalgieOptions {
  applicationEntryPoint?: string;
  functionsEntryPoint?: string;
  buildDir?: string;
  buildEnvironment?: 'development' | 'production';
  rootDir?: string;
  staticDir?: string;
}
export interface NostalgieSettings extends Readonly<Required<NostalgieOptions>> {
  readonly builtFunctionsPath: string;
  readonly builtServerPath: string;
  readonly resolveExtensions: ReadonlyArray<string>;

  readonly loaders: {
    readonly [ext: string]: Loader;
  };
}

export function readNormalizedSettings(options: NostalgieOptions = {}): NostalgieSettings {
  const rootDir = options.rootDir || process.cwd();
  const buildDir = Path.resolve(rootDir, './build');

  return {
    applicationEntryPoint: Path.resolve(rootDir, './src/App'),
    buildDir: buildDir,
    buildEnvironment: options.buildEnvironment || 'development',
    builtFunctionsPath: Path.resolve(buildDir, './functions.js'),
    builtServerPath: Path.resolve(buildDir, './index.js'),
    functionsEntryPoint: Path.resolve(rootDir, './src/functions'),
    loaders: {
      '.css': 'file',
      '.ico': 'file',
      '.png': 'file',
      '.svg': 'file',
    },
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx'],
    rootDir: rootDir,
    staticDir: Path.resolve(buildDir, './static'),
  };
}
