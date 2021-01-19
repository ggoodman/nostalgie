import type { Metadata, Service } from 'esbuild';
import * as Path from 'path';
import type { NostalgieSettings } from '../settings';

export async function buildServerFunctions(
  service: Service,
  settings: NostalgieSettings
): Promise<{ functionNames: string[]; serverFunctionsEntry: string | null }> {
  if (!settings.functionsEntryPoint) {
    return {
      functionNames: [],
      serverFunctionsEntry: null,
    };
  }

  const rootDir = settings.rootDir;
  const functionsMetaPath = Path.resolve(rootDir, 'build/functions/meta.json');
  const functionsBuildPath = 'build/functions/functions.js';
  const resolveExtensions = [...settings.resolveExtensions];

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
    incremental: false,
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

  const metaFile = buildResult.outputFiles.find((file) => file.path === functionsMetaPath);

  if (!metaFile) {
    throw new Error(
      `Invariant violation: Unable to locate the functions build result in the function build metadata for ${functionsBuildPath}`
    );
  }

  const metaFileContents = metaFile.text;

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
