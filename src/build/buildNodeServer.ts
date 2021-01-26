import type { AbortSignal } from 'abort-controller';
import type { Service } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { Logger } from 'pino';
import { createRequire } from '../createRequire';
import type { NostalgieSettings } from '../settings';
import { decorateDeferredImportsServerPlugin } from './esbuildPlugins/decorateDeferredImportsServerPlugin';
import { mdxPlugin } from './esbuildPlugins/mdxPlugin';
import { reactShimPlugin } from './esbuildPlugins/reactShimPlugin';
import { svgPlugin } from './esbuildPlugins/svgPlugin';
import type { ClientBuildMetadata } from './metadata';

export async function buildNodeServer(
  service: Service,
  settings: NostalgieSettings,
  logger: Logger,
  clientBuildMetadata: ClientBuildMetadata,
  signal: AbortSignal
) {
  const buildDir = settings.buildDir;
  const nostalgieRequire = createRequire(__filename);
  const appRequire = createRequire(settings.applicationEntryPoint);
  const nostalgieHapiServerPath = appRequire.resolve('nostalgie/internal/runtimes/node');
  // const nostalgiePiscinaWorkerPath = Path.resolve(require.resolve('piscina'), '../worker.js');
  const nostalgieServerPath = appRequire.resolve('nostalgie/internal/server');
  const resolveExtensions = [...settings.resolveExtensions];
  const relativeAppEntry = `./${Path.relative(settings.rootDir, settings.applicationEntryPoint)}`;

  const serverFunctionsImport = settings.functionsEntryPoint
    ? `import * as Functions from ${JSON.stringify(
        `./${Path.relative(settings.rootDir, settings.functionsEntryPoint)}`
      )}`
    : 'const Functions = {};';

  const buildPromises: Array<Promise<unknown>> = [
    // Build the SSR library
    service.build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(settings.buildEnvironment),
        'process.env.NOSTALGIE_BUILD_TARGET': JSON.stringify('server'),
      },
      format: 'cjs',
      inject: [appRequire.resolve('nostalgie/internal/node-browser-apis')],
      loader: settings.loaders,
      logLevel: 'error',
      minify: settings.buildEnvironment === 'production',
      outbase: Path.dirname(settings.applicationEntryPoint),
      outfile: Path.resolve(settings.buildDir, 'ssr.js'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [
        mdxPlugin({ signal }),
        svgPlugin(),
        reactShimPlugin(settings),
        decorateDeferredImportsServerPlugin({
          relativePath: settings.applicationEntryPoint,
          buildDir,
          clientBuildMetadata,
          logger,
          resolveExtensions,
          rootDir: settings.rootDir,
        }),
      ],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: `
import { ServerRenderer } from ${JSON.stringify(nostalgieServerPath)};
import { worker } from ${JSON.stringify(nostalgieRequire.resolve('workerpool'))};
import App from ${JSON.stringify(relativeAppEntry)};
${serverFunctionsImport}

const renderer = new ServerRenderer(App, Functions, ${JSON.stringify(
          clientBuildMetadata.getChunkDependenciesObject()
        )});

worker({
  invokeFunction: renderer.invokeFunction.bind(renderer),
  renderAppOnServer: renderer.renderAppOnServer.bind(renderer),
});
        `,
        loader: 'js',
        resolveDir: settings.rootDir,
        sourcefile: Path.resolve(settings.applicationEntryPoint, '../worker.js'),
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
      format: 'cjs',
      logLevel: 'error',
      minify: settings.buildEnvironment === 'production',
      outfile: Path.resolve(settings.buildDir, './index.js'),
      publicPath: '/static/build',
      platform: 'node',
      plugins: [],
      resolveExtensions,
      sourcemap: true,
      stdin: {
        contents: `
const { main, startServer } = require(${JSON.stringify(nostalgieHapiServerPath)});

exports.startServer = startServer;

if (require.main === module) {
  main({
    buildDir: __dirname,
  });
}
        `,
        loader: 'js',
        resolveDir: settings.rootDir,
        sourcefile: Path.resolve(settings.applicationEntryPoint, '../server.js'),
      },
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
