import * as Path from 'path';

export interface NostalgieOptions {
  applicationEntryPoint?: string;
  functionsEntryPoint?: string;
  buildDir?: string;
  buildEnvironment?: 'development' | 'production';
  rootDir?: string;
  staticDir?: string;
}
export interface NostalgieSettings extends Readonly<Required<NostalgieOptions>> {}

export function readNormalizedSettings(options: NostalgieOptions = {}): NostalgieSettings {
  const rootDir = options.rootDir || process.cwd();
  const buildDir = Path.resolve(rootDir, './build');

  return {
    applicationEntryPoint: Path.resolve(rootDir, './src/App'),
    buildDir: buildDir,
    buildEnvironment: options.buildEnvironment || 'development',
    functionsEntryPoint: Path.resolve(rootDir, './src/functions'),
    rootDir: rootDir,
    staticDir: Path.resolve(buildDir, './static'),
  };
}
