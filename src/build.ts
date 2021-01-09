import { Loader, Metadata, Service, startService } from 'esbuild';
import { promises as Fs } from 'fs';
import Module from 'module';
import * as Path from 'path';
import { decorateDeferredImportsBrowserPlugin } from './esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { decorateDeferredImportsServerPlugin } from './esbuildPlugins/decorateDeferredImportsServerPlugin';
import { markdownPlugin } from './esbuildPlugins/markdownPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { resolveNostalgiePlugin } from './esbuildPlugins/resolveNostalgiePlugin';
import { resolvePlugin } from './esbuildPlugins/resolvePlugin';
import { serverFunctionProxyPlugin } from './esbuildPlugins/serverFunctionProxyPlugin';
import type { NostalgieSettingsReader } from './settings';

const loaders: {
  [ext: string]: Loader;
} = {
  '.ico': 'file',
  '.png': 'file',
};
const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export async function build(
  settings: NostalgieSettingsReader
): Promise<{
  loadHapiServer(): Promise<typeof import('../runtime/server/node')>;
}> {
  return withCleanup(async (defer) => {
    const rootDir = settings.get('rootDir');
    const cwd = process.cwd();
    process.chdir(rootDir);
    defer(() => process.chdir(cwd));

    const service = await startService();
    defer(() => service.stop());

    const functionNamesPromise = (async () => {
      const functionNames = await buildServerFunctions(service, settings);

      console.error(
        '✅ Successfully wrote server functions to: %s',
        Path.resolve(settings.get('rootDir'), './build/functions.mjs')
      );

      return functionNames;
    })();
    const clientBuildMetadataPromise = (async () => {
      const { functionNames } = await functionNamesPromise;
      const clientBuildMetadata = await buildClient(service, settings, functionNames);

      console.error(
        '✅ Successfully wrote the client assets to: %s',
        Path.resolve(settings.get('rootDir'), './build/static/')
      );

      return clientBuildMetadata;
    })();

    const nodeServerPromise = (async () => {
      const clientBuildMetadata = await clientBuildMetadataPromise;
      // const { serverFunctionsSourcePath } = await functionNamesPromise;

      await buildNodeServer(service, settings, clientBuildMetadata);

      console.error(
        '✅ Successfully wrote the node server build to: %s',
        Path.resolve(settings.get('rootDir'), './build/index.js')
      );
    })();

    const packageJsonPromise = (async () => {
      await Fs.mkdir(settings.get('buildDir'), { recursive: true });
      await Fs.writeFile(
        Path.join(settings.get('buildDir'), 'package.json'),
        JSON.stringify(
          {
            name: 'nostalgie-app',
            version: '0.0.0',
            private: true,
            main: './index.js',
            // type: 'module',
            engines: {
              node: '> 12.2.0',
            },
            engineStrict: true,
            scripts: {
              start: 'node ./index.js',
            },
          },
          null,
          2
        )
      );
    })();

    await Promise.all([
      clientBuildMetadataPromise,
      functionNamesPromise,
      nodeServerPromise,
      packageJsonPromise,
    ]);

    return {
      async loadHapiServer() {
        // const dynamicImport = new Function('path', 'return import(path);');
        const require = Module.createRequire(Path.join(settings.get('rootDir'), 'index.js'));

        return require('./build/index.js') as typeof import('../runtime/server/node');
      },
    };
  });
}

async function buildClient(
  service: Service,
  settings: NostalgieSettingsReader,
  functionNames: string[]
): Promise<Metadata> {
  const rootDir = settings.get('rootDir');
  const clientMetaPath = Path.resolve(rootDir, 'build/static/clientMetadata.json');
  const serverFunctionsPath = Path.resolve(rootDir, settings.get('functionsEntryPoint'));
  const nostalgieBootstrapPath = Path.resolve(__dirname, '../runtime/browser/bootstrap.tsx');

  await service.build({
    bundle: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
      'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('browser'),
      'process.env.NOSTALGIE_RPC_PATH': JSON.stringify('/_nostalgie/rpc'),
      'process.env.NOSTALGIE_PUBLIC_URL': '""',
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
      resolvePlugin('__nostalgie_app__', settings.get('applicationEntryPoint'), ['default']),
      serverFunctionProxyPlugin(resolveExtensions, serverFunctionsPath, functionNames),
    ],
    publicPath: '/static/build',
    resolveExtensions,
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
}

async function buildServerFunctions(service: Service, settings: NostalgieSettingsReader) {
  const rootDir = settings.get('rootDir');
  const functionsMetaPath = Path.resolve(rootDir, 'build/functions/meta.json');
  const functionsBuildPath = 'build/functions/functions.mjs';

  const buildResult = await service.build({
    bundle: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
      'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
    },
    logLevel: 'error',
    entryPoints: [`./${Path.relative(rootDir, settings.get('functionsEntryPoint'))}`],
    external: [],
    format: 'esm',
    incremental: true,
    loader: loaders,
    metafile: functionsMetaPath,
    minify: settings.get('buildEnvironment') === 'production',
    outbase: Path.resolve(settings.get('functionsEntryPoint'), '../nostalgie'),
    outfile: Path.resolve(rootDir, functionsBuildPath),
    platform: 'node',
    plugins: [],
    publicPath: '/static/build',
    resolveExtensions,
    sourcemap: false,
    splitting: false,
    // stdin: {
    //   contents: `export * from ${JSON.stringify(
    //     `./${Path.relative(rootDir, settings.get('functionsEntryPoint'))}`
    //   )};`,
    //   loader: 'js',
    //   resolveDir: rootDir,
    //   sourcefile: functionsShimPath,
    // },
    treeShaking: true,
    write: false,
  });

  const metaFile = buildResult.outputFiles.find((file) => file.path === functionsMetaPath);

  if (!metaFile) {
    throw new Error(
      `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
    );
  }

  const metaFileContents = metaFile.text;

  // The metadata has potentially sensitive info like local paths
  // await Fs.unlink(functionsMetaPath);

  const metaFileData: Metadata = JSON.parse(metaFileContents);
  const functionsOutput = metaFileData.outputs[functionsBuildPath];

  if (!functionsOutput) {
    console.error(metaFileData.outputs, functionsBuildPath);

    throw new Error(
      `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
    );
  }

  const functionsShimImports = metaFileData.inputs[Object.keys(metaFileData.inputs)[0]];

  if (!functionsShimImports) {
    console.error(metaFileData.outputs, functionsBuildPath);

    throw new Error(
      `Invariant violation: Unable to locate the functions shim metadata in the function build input metadata for ${Path.resolve(
        rootDir,
        functionsBuildPath
      )}`
    );
  }

  return {
    functionNames: functionsOutput.exports,
    /**
     * Absolute path to the USER's functions file
     */
    // serverFunctionsSourcePath: Path.resolve(rootDir, functionsShimImports.imports[0].path),
    serverFunctionsEntry: Path.resolve(rootDir, functionsBuildPath),
  };
}

async function buildNodeServer(
  service: Service,
  settings: NostalgieSettingsReader,
  clientBuildMetadata: Metadata
) {
  const buildDir = settings.get('buildDir');
  const nostalgieHapiServerPath = Path.resolve(__dirname, '../runtime/server/node.ts');
  const nostalgiePiscinaWorkerPath = Path.resolve(require.resolve('piscina'), '../worker.js');
  const nostalgieSsrWorkerPath = Path.resolve(__dirname, '../runtime/server/ssr.tsx');

  const buildPromises: Array<Promise<unknown>> = [
    // Build the Piscina worker shim needed to act as a wrapper around the ssr entrypoint
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      format: 'cjs',
      loader: loaders,
      logLevel: 'error',
      minify: settings.get('buildEnvironment') === 'production',
      outbase: Path.dirname(settings.get('applicationEntryPoint')),
      outdir: settings.get('buildDir'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: await Fs.readFile(nostalgiePiscinaWorkerPath, 'utf8'),
        loader: 'js',
        resolveDir: Path.dirname(nostalgiePiscinaWorkerPath),
        sourcefile: Path.resolve(settings.get('applicationEntryPoint'), '../worker.js'),
      },
      target: ['node12'],
      treeShaking: true,
      write: true,
    }),

    // Build the SSR library
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      format: 'cjs',
      loader: loaders,
      logLevel: 'error',
      minify: settings.get('buildEnvironment') === 'production',
      outbase: Path.dirname(settings.get('applicationEntryPoint')),
      outfile: Path.resolve(settings.get('buildDir'), 'ssr.js'),
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
        resolvePlugin('__nostalgie_app__', settings.get('applicationEntryPoint'), ['default']),
        resolvePlugin('__nostalgie_functions__', settings.get('functionsEntryPoint'), ['*']),
        // externalizePlugin(serverFunctionsSourcePath, './functions/functions.mjs'),
      ],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: await Fs.readFile(nostalgieSsrWorkerPath, 'utf8'),
        loader: 'tsx',
        resolveDir: Path.dirname(nostalgieSsrWorkerPath),
        sourcefile: Path.resolve(settings.get('applicationEntryPoint'), '../ssr.tsx'),
      },
      target: ['node12'],
      treeShaking: true,
      write: true,
    }),

    // Build the node runtime
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.get('buildEnvironment')),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      entryPoints: [nostalgieHapiServerPath],
      format: 'cjs',
      // loader: loaders,
      logLevel: 'error',
      minify: settings.get('buildEnvironment') === 'production',
      outfile: Path.resolve(settings.get('buildDir'), './index.js'),
      // outdir: settings.get('buildDir'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [],
      resolveExtensions,
      sourcemap: true,
      // stdin: {
      //   contents: await Fs.readFile(nostalgieHapiServerPath, 'utf8'),
      //   loader: 'ts',
      //   resolveDir: Path.dirname(nostalgieHapiServerPath),
      //   sourcefile: Path.resolve(settings.get('applicationEntryPoint'), '../index.tsx'),
      // },
      target: ['node12'],
      treeShaking: true,
      write: true,
    }),

    // Write the node runtime docker file
    Fs.writeFile(
      Path.resolve(settings.get('buildDir'), './Dockerfile'),
      `
FROM node:14-alpine
USER node
WORKDIR /srv
ADD . /srv/
ENV PORT=8080 NODE_ENV=${settings.get('buildEnvironment')}
CMD [ "node",  "/srv/index.js" ]
  `.trim() + '\n'
    ),
  ];

  await Promise.all(buildPromises);
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
