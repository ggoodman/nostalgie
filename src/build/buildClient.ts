import type { AbortSignal } from 'abort-controller';
import type { Metadata, Plugin, Service } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import { createRequire } from '../createRequire';
import type { NostalgieSettings } from '../settings';
import { decorateDeferredImportsBrowserPlugin } from './esbuildPlugins/decorateDeferredImportsBrowserPlugin';
import { mdxPlugin } from './esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { serverFunctionProxyPlugin } from './esbuildPlugins/serverFunctionProxyPlugin';
import { svgPlugin } from './esbuildPlugins/svgPlugin';

export async function buildClient(
  service: Service,
  settings: NostalgieSettings,
  functionNames: string[],
  signal: AbortSignal
): Promise<Metadata> {
  const staticDir = settings.staticDir;
  const clientMetaPath = Path.resolve(staticDir, './clientMetadata.json');
  const runtimeRequire = createRequire(Path.resolve(settings.buildDir, './index.js'));
  const nostalgieBootstrapPath = runtimeRequire.resolve('nostalgie/bootstrap');
  const resolveExtensions = [...settings.resolveExtensions];
  const relativeAppEntry = `./${Path.relative(settings.rootDir, settings.applicationEntryPoint)}`;

  const plugins: Plugin[] = [
    mdxPlugin({ signal }),
    svgPlugin(),
    reactShimPlugin(settings),
    decorateDeferredImportsBrowserPlugin({
      rootDir: settings.rootDir,
    }),
  ];

  if (settings.functionsEntryPoint) {
    plugins.push(
      serverFunctionProxyPlugin(resolveExtensions, settings.functionsEntryPoint, functionNames)
    );
  }

  await service.build({
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
    incremental: false,
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

  const metaFileContents = await Fs.readFile(clientMetaPath, 'utf8');

  // The metadata has potentially sensitive info like local paths
  await Fs.unlink(clientMetaPath);

  const metaFileData: Metadata = JSON.parse(metaFileContents);

  return metaFileData;
}
