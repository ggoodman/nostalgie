import { channel, Channel, select } from '@ggoodman/channels';
import type { AbortSignal } from 'abort-controller';
import { watch } from 'chokidar';
import type { BuildInvalidate, Metadata, OutputFile, Plugin, Service } from 'esbuild';
import * as Path from 'path';
import { createRequire } from '../createRequire';
import type { NostalgieSettings } from '../settings';
import { decorateDeferredImportsBrowserPlugin } from './esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { mdxPlugin } from './esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { serverFunctionProxyPlugin } from './esbuildPlugins/serverFunctionProxyPlugin';
import { svgPlugin } from './esbuildPlugins/svgPlugin';
import type { ServerFunctionBuildResult } from './functions';

export interface ClientBuildResult {}

export async function buildServerFunctions(
  settings: NostalgieSettings,
  service: Service,
  signal: AbortSignal,
  closeCh: Channel<void>,
  functionBuildsCh: Channel<ServerFunctionBuildResult>,
  resultsCh: Channel<ClientBuildResult>
): Promise<void> {
  const staticDir = settings.staticDir;
  const clientMetaPath = Path.resolve(staticDir, './clientMetadata.json');
  const runtimeRequire = createRequire(Path.resolve(settings.buildDir, './index.js'));
  const nostalgieBootstrapPath = runtimeRequire.resolve('nostalgie/internal/bootstrap');
  const resolveExtensions = [...settings.resolveExtensions];
  const relativeAppEntry = `./${Path.relative(settings.rootDir, settings.applicationEntryPoint)}`;

  const functionBuildsConsumer = (async () => {
    for await (const entry of select({ close: closeCh, functionBuild: functionBuildsCh })) {
      // This should never actually happen since we don't expect the close channel to ever
      // have any entries. Instead it will close, breaking out of the for await..of loop.
      if (entry.key === 'close') break;

      const { functionNames, serverFunctionsEntry } = entry.value;
    }
  })();

  const plugins: Plugin[] = [
    mdxPlugin({ signal }),
    svgPlugin(),
    reactShimPlugin(settings),
    decorateDeferredImportsBrowserPlugin({
      rootDir: settings.rootDir,
    }),
  ];
  const serverFunctionProxyPluginOptions = {
    functionsPath: settings.functionsEntryPoint,
    functionNames: [],
  };

  let rebuild: BuildInvalidate | undefined;

  if (settings.functionsEntryPoint) {
    plugins.push(serverFunctionProxyPlugin(serverFunctionProxyPluginOptions));
  }

  const { rebuild, ...buildResult } = await service.build({
    bundle: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
      'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('browser'),
      'process.env.NOSTALGIE_RPC_PATH': JSON.stringify('/.nostalgie/rpc'),
      'process.env.NOSTALGIE_PUBLIC_URL': '"/"',
    },
    logLevel: 'error',
    external: [],
    format: 'esm',
    incremental: true,
    loader: settings.loaders,
    metafile: clientMetaPath,
    minify: settings.buildEnvironment === 'production',
    outbase: Path.dirname(settings.applicationEntryPoint),
    outdir: Path.resolve(staticDir, './build'),
    platform: 'browser',
    plugins,
    publicPath: '/static/build/',
    resolveExtensions,
    mainFields: ['module', 'browser', 'main'],
    sourcemap: true,
    splitting: true,
    stdin: {
      contents: `
import { hydrateNostalgie } from ${JSON.stringify(nostalgieBootstrapPath)};
import App from ${JSON.stringify(relativeAppEntry)}

export function start(options) {
  return hydrateNostalgie(App, options);
}
      `,
      loader: 'js',
      resolveDir: settings.rootDir,
      sourcefile: Path.resolve(settings.applicationEntryPoint, '../bootstrap.js'),
    },
    treeShaking: true,
  });

  console.debug('Initial build completed');

  if (typeof rebuild !== 'function') {
    throw new Error('Invariant violation: Expected rebuild to be a function');
  }

  const buildsCh = channel<Metadata>();
  const changesCh = channel<void>();
  const watcher = watch([], {
    interval: 600,
    ignoreInitial: true,
  });
  const watchedFiles = new Set<string>();

  const buildsConsumer = (async () => {
    for await (const entry of select({ build: buildsCh, close: closeCh })) {
      // This should never actually happen since we don't expect the close channel to ever
      // have any entries. Instead it will close, breaking out of the for await..of loop.
      if (entry.key === 'close') break;

      console.debug('buildsConsumer', entry);

      const metaFileData = entry.value;
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

      const newFiles = new Set(Object.keys(metaFileData.inputs));

      for (const oldFile of watchedFiles) {
        if (!newFiles.has(oldFile)) {
          watcher.unwatch(oldFile);
          watchedFiles.delete(oldFile);
        }
      }

      for (const newFile of newFiles) {
        if (!watchedFiles.has(newFile)) {
          watcher.add(newFile);
          watchedFiles.add(newFile);
        }
      }

      resultsCh.put({
        functionNames: functionsOutput.exports,
        /**
         * Absolute path to the USER's functions file
         */
        // serverFunctionsSourcePath: Path.resolve(rootDir, functionsShimImports.imports[0].path),
        serverFunctionsEntry: Path.resolve(rootDir, functionsBuildPath),
      });
    }
  })();

  const changesConsumer = (async () => {
    for await (const entry of select({ change: changesCh, close: closeCh })) {
      // This should never actually happen since we don't expect the close channel to ever
      // have any entries. Instead it will close, breaking out of the for await..of loop.
      if (entry.key === 'close') break;

      console.debug('changesConsumer', entry);

      const buildResult = await rebuild();

      if (buildResult.outputFiles) {
        buildsCh.put(readMetaFile(buildResult.outputFiles, functionsMetaPath));
      }
    }
  })();

  // Start your engines!
  buildsCh.put(readMetaFile(buildResult.outputFiles, functionsMetaPath));

  watcher.on('all', () => changesCh.put(undefined));

  try {
    await Promise.all([buildsConsumer, changesConsumer]);
  } finally {
    watcher.close();
  }
}

function readMetaFile(outputFiles: OutputFile[], metaPath: string) {
  const metaFile = outputFiles.find((file) => file.path === metaPath);

  if (!metaFile) {
    throw new Error(
      `Invariant violation: Unable to locate the functions build result in the function build metadata for ${metaPath}`
    );
  }

  const metaFileContents = metaFile.text;
  const metaFileData: Metadata = JSON.parse(metaFileContents);

  return metaFileData;
}
