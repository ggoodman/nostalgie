import type { Loader } from 'esbuild';
import * as Path from 'path';
import resolveSpec, { AsyncOpts } from 'resolve';

type FrozenInterface<T, TOptional extends keyof T = never> = {
  readonly [TKey in keyof Omit<T, TOptional>]-?: T[TKey];
} &
  {
    readonly [TKey in TOptional]: T[TKey];
  };

export interface NostalgieAuthOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  cookieSecret: string;
}

export interface NostalgieOptions {
  applicationEntryPoint?: string;
  auth?: NostalgieAuthOptions;
  functionsEntryPoint?: string | null;
  buildDir?: string;
  buildEnvironment?: 'development' | 'production';
  rootDir?: string;
  staticDir?: string;
}
export interface NostalgieSettings extends FrozenInterface<NostalgieOptions, 'auth'> {
  readonly builtFunctionsPath: string;
  readonly builtServerPath: string;
  readonly resolveExtensions: ReadonlyArray<string>;

  readonly loaders: {
    readonly [ext: string]: Loader;
  };
}

function resolveAsync(spec: string, options: AsyncOpts) {
  return new Promise<string | undefined>((resolve, reject) =>
    resolveSpec(spec, options, (err, resolved) => {
      if (err && (err as any).code !== 'MODULE_NOT_FOUND') {
        return reject(err);
      }

      return resolve(resolved);
    })
  );
}

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
    auth: readAuthOptions(options),
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

function readAuthOptions(options: NostalgieOptions = {}) {
  const partialAuth: Partial<NostalgieAuthOptions> = {
    issuer: options.auth?.issuer ?? process.env.AUTH_ISSUER,
    clientId: options.auth?.clientId ?? process.env.AUTH_CLIENT_ID,
    clientSecret: options.auth?.clientSecret ?? process.env.AUTH_CLIENT_SECRET,
    cookieSecret: options.auth?.cookieSecret ?? process.env.AUTH_COOKIE_SECRET,
  };

  const authEntries = Object.entries(partialAuth);
  const emptyEntries = authEntries.filter((entry) => !entry[1]);

  if (emptyEntries.length) {
    if (emptyEntries.length < authEntries.length) {
      throw new Error(
        `When providing authentication information, the ${authEntries
          .map((entry) => entry[0])
          .map((k) => JSON.stringify(`auth.${k}`))
          .join(
            ', '
          )} settings must be provided, however only the following were missing or empty: ${emptyEntries
          .map((entry) => entry[0])
          .map((k) => JSON.stringify(`auth.${k}`))
          .join(', ')}`
      );
    }
    return undefined;
  }

  return partialAuth as NostalgieAuthOptions;
}
