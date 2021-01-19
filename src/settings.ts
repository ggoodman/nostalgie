import type { Loader } from 'esbuild';
import * as Path from 'path';
import resolveSpec, { AsyncOpts } from 'resolve';

export interface NostalgieOptions {
  applicationEntryPoint?: string;
  functionsEntryPoint?: string | null;
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

const resolveAsync = (spec: string, options: AsyncOpts) =>
  new Promise<string | undefined>((resolve, reject) =>
    resolveSpec(spec, options, (err, resolved) => {
      if (err && (err as any).code !== 'MODULE_NOT_FOUND') {
        return reject(err);
      }

      return resolve(resolved);
    })
  );

export async function readNormalizedSettings(
  options: NostalgieOptions = {}
): Promise<NostalgieSettings> {
  const rootDir = options.rootDir || process.cwd();
  const buildDir = Path.resolve(rootDir, './build');
  const defaultExtensions = ['.js', '.jsx', '.ts', '.tsx'];

  const applicationEntryPointOption = options.applicationEntryPoint || './src/App';
  const applicationEntryPoint = await resolveAsync(applicationEntryPointOption, {
    basedir: rootDir,
    extensions: defaultExtensions,
  });

  if (!applicationEntryPoint) {
    throw new Error(
      `Unable to find your application entrypoint ${JSON.stringify(
        applicationEntryPointOption
      )}. Make sure your application entrypoint can be found in the "./src" directory and has one of the supported extensions: ${defaultExtensions
        .map((x) => JSON.stringify(x))
        .join(', ')}.`
    );
  }

  const functionsEntryPoint = await resolveAsync(options.functionsEntryPoint || './src/functions', {
    basedir: rootDir,
    extensions: defaultExtensions,
  });

  return {
    applicationEntryPoint,
    buildDir: buildDir,
    buildEnvironment: options.buildEnvironment || 'development',
    builtFunctionsPath: Path.resolve(buildDir, './functions.js'),
    builtServerPath: Path.resolve(buildDir, './index.js'),
    functionsEntryPoint: functionsEntryPoint ?? null,
    loaders: {
      '.css': 'file',
      '.ico': 'file',
      '.png': 'file',
      '.svg': 'file',
    },
    resolveExtensions: defaultExtensions,
    rootDir: rootDir,
    staticDir: Path.resolve(buildDir, './static'),
  };
}
