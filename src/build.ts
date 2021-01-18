import type { Loader, Metadata, Service } from 'esbuild';
import { promises as Fs } from 'fs';
import Module from 'module';
import * as Path from 'path';
import type { Logger } from 'pino';
import { decorateDeferredImportsBrowserPlugin } from './esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { decorateDeferredImportsServerPlugin } from './esbuildPlugins/decorateDeferredImportsServerPlugin';
import { mdxPlugin } from './esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { resolveNostalgiePlugin } from './esbuildPlugins/resolveNostalgiePlugin';
import { resolvePlugin } from './esbuildPlugins/resolvePlugin';
import { serverFunctionProxyPlugin } from './esbuildPlugins/serverFunctionProxyPlugin';
import { svgPlugin } from './esbuildPlugins/svgPlugin';
import { ClientBuildMetadata } from './metadata';
import type { NostalgieSettings } from './settings';

const createRequire = Module.createRequire || Module.createRequireFromPath;

const loaders: {
  [ext: string]: Loader;
} = {
  '.css': 'file',
  '.ico': 'file',
  '.png': 'file',
  '.svg': 'file',
};
const resolveExtensions = ['.js', '.jsx', '.ts', '.tsx'];

export async function build(options: {
  logger: Logger;
  settings: NostalgieSettings;
  service: Service;
}) {
  const { logger, settings, service } = options;

  const rebuild = async () => {
    const functionNamesPromise = (async () => {
      const functionNames = await buildServerFunctions(service, settings);

      logger.info(
        { pathName: Path.resolve(settings.rootDir, './build/functions.js') },
        'server functions build'
      );

      return functionNames;
    })();
    const clientBuildMetadataPromise = (async () => {
      const { functionNames } = await functionNamesPromise;
      const clientBuildMetadata = await buildClient(service, settings, functionNames);

      logger.info({ pathName: settings.staticDir }, 'client assets written');

      return new ClientBuildMetadata(settings, clientBuildMetadata);
    })();

    const nodeServerPromise = (async () => {
      const clientBuildMetadata = await clientBuildMetadataPromise;
      // const { serverFunctionsSourcePath } = await functionNamesPromise;

      await buildNodeServer(service, settings, logger, clientBuildMetadata);

      logger.info(
        { pathName: Path.relative(settings.rootDir, './build/index.js') },
        'node server written'
      );
    })();

    const packageJsonPromise = (async () => {
      await Fs.mkdir(settings.buildDir, { recursive: true });
      await Fs.writeFile(
        Path.join(settings.buildDir, 'package.json'),
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
  };

  await rebuild();

  return {
    async loadHapiServer() {
      const require = createRequire(Path.join(settings.rootDir, 'index.js'));

      // TODO: Fix this type when we're back under control (typeof import('../runtime/server/node'))
      return require('./build/index') as any;
    },
    rebuild,
  };
}

async function buildClient(
  service: Service,
  settings: NostalgieSettings,
  functionNames: string[]
): Promise<Metadata> {
  const rootDir = settings.rootDir;
  const staticDir = settings.staticDir;
  const clientMetaPath = Path.resolve(staticDir, './clientMetadata.json');
  const serverFunctionsPath = Path.resolve(rootDir, settings.functionsEntryPoint);
  const nostalgieBootstrapPath = Path.resolve(__dirname, '../runtime/browser/bootstrap.tsx');

  await service.build({
    bundle: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
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
    minify: settings.buildEnvironment === 'production',
    outbase: Path.dirname(settings.applicationEntryPoint),
    outdir: Path.resolve(staticDir, './build'),
    platform: 'browser',
    plugins: [
      resolveNostalgiePlugin(),
      mdxPlugin(settings.applicationEntryPoint),
      svgPlugin(),
      reactShimPlugin(),
      decorateDeferredImportsBrowserPlugin({
        rootDir: settings.rootDir,
      }),
      resolvePlugin(settings.rootDir, '__nostalgie_app__', settings.applicationEntryPoint, [
        'default',
      ]),
      serverFunctionProxyPlugin(resolveExtensions, serverFunctionsPath, functionNames),
    ],
    publicPath: '/static/build',
    resolveExtensions,
    mainFields: ['module', 'browser', 'main'],
    sourcemap: true,
    splitting: true,
    stdin: {
      contents: await Fs.readFile(nostalgieBootstrapPath, 'utf8'),
      loader: 'tsx',
      resolveDir: Path.dirname(settings.applicationEntryPoint),
      sourcefile: Path.resolve(settings.applicationEntryPoint, '../bootstrap.tsx'),
    },
    treeShaking: true,
  });

  const metaFileContents = await Fs.readFile(clientMetaPath, 'utf8');

  // The metadata has potentially sensitive info like local paths
  await Fs.unlink(clientMetaPath);

  const metaFileData: Metadata = JSON.parse(metaFileContents);

  return metaFileData;
}

async function buildServerFunctions(service: Service, settings: NostalgieSettings) {
  const rootDir = settings.rootDir;
  const functionsMetaPath = Path.resolve(rootDir, 'build/functions/meta.json');
  const functionsBuildPath = 'build/functions/functions.js';

  const buildResult = await service.build({
    bundle: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
      'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
    },
    logLevel: 'error',
    entryPoints: [`./${Path.relative(rootDir, settings.functionsEntryPoint)}`],
    external: [],
    format: 'esm',
    incremental: true,
    loader: loaders,
    metafile: functionsMetaPath,
    minify: settings.buildEnvironment === 'production',
    outbase: Path.resolve(settings.functionsEntryPoint, '../nostalgie'),
    outfile: Path.resolve(rootDir, functionsBuildPath),
    platform: 'node',
    plugins: [],
    publicPath: '/static/build',
    resolveExtensions,
    sourcemap: false,
    splitting: false,
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
    throw new Error(
      `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
    );
  }

  const functionsShimImports = metaFileData.inputs[Object.keys(metaFileData.inputs)[0]];

  if (!functionsShimImports) {
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
  settings: NostalgieSettings,
  logger: Logger,
  clientBuildMetadata: ClientBuildMetadata
) {
  const buildDir = settings.buildDir;
  const nostalgieHapiServerPath = Path.resolve(__dirname, '../runtime/server/node.ts');
  // const nostalgiePiscinaWorkerPath = Path.resolve(require.resolve('piscina'), '../worker.js');
  const nostalgieSsrWorkerPath = Path.resolve(__dirname, '../runtime/server/ssr.tsx');

  const buildPromises: Array<Promise<unknown>> = [
    // Build the SSR library
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
        __nostalgie_chunks__: JSON.stringify(clientBuildMetadata.getChunkDependenciesObject()),
      },
      format: 'cjs',
      loader: loaders,
      logLevel: 'error',
      minify: settings.buildEnvironment === 'production',
      outbase: Path.dirname(settings.applicationEntryPoint),
      outfile: Path.resolve(settings.buildDir, 'ssr.js'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [
        resolveNostalgiePlugin(),
        mdxPlugin(),
        svgPlugin(),
        reactShimPlugin(),
        decorateDeferredImportsServerPlugin({
          relativePath: settings.applicationEntryPoint,
          buildDir,
          clientBuildMetadata,
          logger,
          resolveExtensions,
          rootDir: settings.rootDir,
        }),
        resolvePlugin(settings.rootDir, '__nostalgie_app__', settings.applicationEntryPoint, [
          'default',
        ]),
        resolvePlugin(settings.rootDir, '__nostalgie_functions__', settings.functionsEntryPoint, [
          '*',
        ]),
      ],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: await Fs.readFile(nostalgieSsrWorkerPath, 'utf8'),
        loader: 'tsx',
        resolveDir: Path.dirname(nostalgieSsrWorkerPath),
        sourcefile: Path.resolve(settings.applicationEntryPoint, '../ssr.tsx'),
      },
      target: ['node12'],
      treeShaking: true,
      write: true,
    }),

    // Build the node runtime
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      entryPoints: [nostalgieHapiServerPath],
      format: 'cjs',
      logLevel: 'error',
      minify: settings.buildEnvironment === 'production',
      outfile: Path.resolve(settings.buildDir, './index.js'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [],
      resolveExtensions,
      sourcemap: true,
      target: ['node12'],
      treeShaking: true,
      write: true,
    }),

    // Write the node runtime docker file
    Fs.writeFile(
      Path.resolve(settings.buildDir, './Dockerfile'),
      `
FROM node:14-alpine
USER node
WORKDIR /srv
ADD . /srv/
ENV PORT=8080 NODE_ENV=${settings.buildEnvironment}
CMD [ "node",  "/srv/index.js" ]
  `.trim() + '\n'
    ),
  ];

  await Promise.all(buildPromises);
}
