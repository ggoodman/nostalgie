import { channel, Channel, select } from '@ggoodman/channels';
import { watch } from 'chokidar';
import type { Metadata, OutputFile, Service } from 'esbuild';
import * as Path from 'path';
import type { NostalgieSettings } from '../settings';

export interface ServerFunctionBuildResult {
  functionNames: string[];
  serverFunctionsEntry: string | null;
}

export async function buildServerFunctions(
  settings: NostalgieSettings,
  service: Service,
  closeCh: Channel<void>,
  resultsCh: Channel<ServerFunctionBuildResult>
): Promise<void> {
  if (!settings.functionsEntryPoint) {
    await resultsCh.put({
      functionNames: [],
      serverFunctionsEntry: null,
    });

    return;
  }

  // const resultsCh = channel<{}>(1)
  const rootDir = settings.rootDir;
  const functionsMetaPath = Path.resolve(rootDir, 'build/functions/meta.json');
  const functionsBuildPath = 'build/functions/functions.js';
  const resolveExtensions = [...settings.resolveExtensions];

  const { rebuild, ...buildResult } = await service.build({
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
    loader: settings.loaders,
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
