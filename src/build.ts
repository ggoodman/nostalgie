import { Loader, Metadata, Service, startService } from 'esbuild';
import { promises as Fs } from 'fs';
import Module from 'module';
import * as Path from 'path';
import { decorateDeferredImportsBrowserPlugin } from './esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { decorateDeferredImportsServerPlugin } from './esbuildPlugins/decorateDeferredImportsServerPlugin';
import { markdownPlugin } from './esbuildPlugins/markdownPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { resolveAppEntryPointPlugin } from './esbuildPlugins/resolveAppEntryPointPlugin';
import { resolveNostalgiePlugin } from './esbuildPlugins/resolveNostalgiePlugin';
import type { NostalgieSettingsReader } from './settings';

const loaders: {
  [ext: string]: Loader;
} = {
  '.ico': 'file',
  '.png': 'file',
};

export async function build(
  settings: NostalgieSettingsReader
): Promise<{
  loadHapiServer(): typeof import('../runtime/server/hapi');
}> {
  return withCleanup(async (defer) => {
    const service = await startService();
    defer(() => service.stop());

    const clientBuildMetadata = await buildClient(service, settings);

    console.error(
      '✅ Successfully wrote the client assets to: %s',
      Path.resolve(settings.get('rootDir'), './build/static/*')
    );

    await buildHapiServer(service, settings, clientBuildMetadata);

    console.error(
      '✅ Successfully wrote the hapi server build to: %s',
      Path.resolve(settings.get('rootDir'), './build/index.js')
    );

    await Fs.writeFile(
      Path.join(settings.get('buildDir'), 'package.json'),
      JSON.stringify(
        {
          name: 'nostalgie-app',
          version: '0.0.0',
          private: true,
          main: './index.js',
          scripts: {
            start: 'node ./index.js',
          },
        },
        null,
        2
      )
    );

    return {
      loadHapiServer() {
        const createRequire = Module.createRequire || Module.createRequireFromPath;
        const require = createRequire(Path.join(settings.get('rootDir'), 'index.js'));

        return require('./build/index.js') as typeof import('../runtime/server/hapi');
      },
    };
  });
}

async function buildClient(service: Service, settings: NostalgieSettingsReader): Promise<Metadata> {
  return withCleanup(async (defer) => {
    const rootDir = settings.get('rootDir');
    const clientMetaPath = Path.resolve(rootDir, 'build/static/clientMetadata.json');

    const cwd = process.cwd();
    process.chdir(rootDir);
    defer(() => process.chdir(cwd));

    const nostalgieBootstrapPath = Path.resolve(__dirname, '../runtime/browser/bootstrap.tsx');

    await service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('browser'),
      },
      logLevel: 'error',
      external: [],
      format: 'esm',
      incremental: true,
      loader: loaders,
      metafile: clientMetaPath,
      minify: settings.get('buildEnvironment') === 'production',
      outbase: Path.dirname(settings.get('applicationEntryPoint')),
      outdir: Path.resolve(rootDir, './build/static/build'),
      platform: 'browser',
      plugins: [
        resolveNostalgiePlugin(),
        markdownPlugin(settings.get('applicationEntryPoint')),
        reactShimPlugin(),
        decorateDeferredImportsBrowserPlugin({
          rootDir: settings.get('rootDir'),
        }),
        resolveAppEntryPointPlugin(settings.get('applicationEntryPoint')),
      ],
      publicPath: '/static/build',
      resolveExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      sourcemap: true,
      splitting: true,
      stdin: {
        contents: await Fs.readFile(nostalgieBootstrapPath, 'utf8'),
        loader: 'tsx',
        resolveDir: Path.dirname(settings.get('applicationEntryPoint')),
        sourcefile: Path.resolve(settings.get('applicationEntryPoint'), '../bootstrap.tsx'),
      },
      treeShaking: true,
    });

    const metaFileContents = await Fs.readFile(clientMetaPath, 'utf8');

    // The metadata has potentially sensitive info like local paths
    await Fs.unlink(clientMetaPath);

    const metaFileData: Metadata = JSON.parse(metaFileContents);

    return metaFileData;
  });
}

async function buildHapiServer(
  service: Service,
  settings: NostalgieSettingsReader,
  clientBuildMetadata: Metadata
) {
  const buildDir = settings.get('buildDir');
  const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];
  const rootDir = settings.get('rootDir');
  const nostalgieHapiServerPath = Path.resolve(__dirname, '../runtime/server/hapi.ts');
  // const nostalgieBuildWorkerPath = Path.resolve(__dirname, '../runtime/server/ssr.ts');

  // await service.build({
  //   bundle: true,
  //   define: {},

  // })

  await service.build({
    bundle: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
      'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
    },
    loader: loaders,
    logLevel: 'error',
    minify: settings.get('buildEnvironment') === 'production',
    outbase: Path.dirname(settings.get('applicationEntryPoint')),
    outdir: Path.resolve(rootDir, './build/'),
    publicPath: '/static/build',
    platform: 'node',
    plugins: [
      resolveNostalgiePlugin(),
      markdownPlugin(settings.get('applicationEntryPoint')),
      reactShimPlugin(),
      decorateDeferredImportsServerPlugin({
        buildDir,
        clientBuildMetadata,
        resolveExtensions,
        rootDir: settings.get('rootDir'),
      }),
      resolveAppEntryPointPlugin(settings.get('applicationEntryPoint')),
    ],
    resolveExtensions,
    stdin: {
      contents: await Fs.readFile(nostalgieHapiServerPath, 'utf8'),
      loader: 'tsx',
      resolveDir: Path.dirname(nostalgieHapiServerPath),
      sourcefile: Path.resolve(settings.get('applicationEntryPoint'), '../index.tsx'),
    },
    target: 'es2017',
    treeShaking: true,
    write: true,
  });
}

type DeferredCleanupFunction = (...args: any[]) => any;
type WithCleanupFunction = (deferredFn: DeferredCleanupFunction) => void;
export async function withCleanup<
  TResult,
  TFunc extends (defer: WithCleanupFunction) => Promise<any>
>(func: TFunc): Promise<TResult> {
  const onCleanup: DeferredCleanupFunction[] = [];
  const defer: WithCleanupFunction = (deferredFn) => {
    onCleanup.unshift(deferredFn);
  };

  try {
    return await func(defer);
  } finally {
    for (const onCleanupFn of onCleanup) {
      try {
        await onCleanupFn();
      } catch (err) {
        console.error({ err }, 'Error while calling clean-up function');
      }
    }
  }
}
