//@ts-check
const { startService } = require('esbuild');
const { builtinModules } = require('module');
const { rollup } = require('rollup');
const Path = require('path');
const Fs = require('fs').promises;
const RollupPluginNodeResolve = require('@rollup/plugin-node-resolve').nodeResolve;
/** @type {import('@wessberg/rollup-plugin-ts').default} */
//@ts-ignore
const RollupPluginTs = require('@wessberg/rollup-plugin-ts');
const PackageJson = require('../package.json');

const externalModules = [
  '@antfu/shiki',
  // Used only for mdx files. We rely on require.resolve() to work here.
  '@mdx-js/react',
  'chokidar',
  'esbuild',
  // We don't want to bundle this so that applications can choose versions
  'react',
  // We don't want to bundle this so that applications can choose versions
  'react-dom',
  // Used by the builder. We rely on require.resolve() to work here.
  'workerpool',
  ...builtinModules,
];
const runtimeModuleNames = [
  'auth',
  'functions',
  'helmet',
  'lazy',
  'routing',
  'styling',
  'internal/bootstrap',
  'internal/node-browser-apis',
  'internal/runtimes/node',
  'internal/server',
];

const typesPath = Path.resolve(__dirname, '../src/runtime/types.d.ts');
const nostalgieBinPath = Path.resolve(__dirname, '../src/cli/bin/nostalgie');
const nostalgieCmdPath = Path.resolve(__dirname, '../src/cli/bin/nostalgie.cmd');
const readmePath = Path.resolve(__dirname, '../README.md');
const licensePath = Path.resolve(__dirname, '../LICENSE');

const exportMap = {};
const devDependencies = {};
const mergedDependencies = {
  ...(PackageJson.dependencies || {}),
  ...(PackageJson.devDependencies || {}),
};

const metaPaths = {
  cli: '../dist/meta/cli.json',
  mdxCompilerWorker: '../dist/meta/mdxCompilerWorker.json',
  piscinaWorker: '../dist/meta/piscinaWorker.json',
  runtimeModules: '../dist/meta/runtimeModules.json',
};

/**
 *
 * @param {import('esbuild').Service} service
 */
async function buildCli(service) {
  await service.build({
    bundle: true,
    external: externalModules,
    define: {
      // 'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: [Path.resolve(__dirname, '../src/cli/index.ts')],
    format: 'cjs',
    logLevel: 'error',
    metafile: metaPaths.cli,
    minify: true,
    outfile: Path.resolve(__dirname, '../dist/cli.js'),
    platform: 'node',
    target: 'node12.16',
    splitting: false,
    sourcemap: false,
    write: true,
  });
}

/**
 *
 * @param {import('esbuild').Service} service
 */
async function buildMdxCompilerWorker(service) {
  await service.build({
    bundle: true,
    external: externalModules,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: [Path.resolve(__dirname, '../src/worker/mdxCompiler.ts')],
    format: 'cjs',
    logLevel: 'error',
    metafile: metaPaths.mdxCompilerWorker,
    outfile: Path.resolve(__dirname, '../dist/mdxCompilerWorker.js'),
    minify: true,
    platform: 'node',
    target: 'node12.16',
    sourcemap: false,
    splitting: false,
    write: true,
  });
}

/**
 *
 * @param {import('esbuild').Service} service
 */
async function buildPiscinaWorker(service) {
  await service.build({
    bundle: true,
    external: externalModules,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: [Path.resolve(require.resolve('piscina'), '../worker.js')],
    format: 'cjs',
    logLevel: 'error',
    metafile: metaPaths.piscinaWorker,
    minify: true,
    outfile: Path.resolve(__dirname, '../dist/worker.js'),
    platform: 'node',
    target: 'node12.16',
    sourcemap: false,
    splitting: false,
    write: true,
  });
}

/**
 *
 * @param {import('esbuild').Service} service
 */
async function buildRuntimeModules(service) {
  await service.build({
    bundle: true,
    external: externalModules,
    define: {
      // 'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: runtimeModuleNames.map((n) =>
      Path.resolve(__dirname, `../src/runtime/${n}/index.ts`)
    ),
    format: 'esm',
    logLevel: 'error',
    mainFields: ['module', 'main'],
    metafile: metaPaths.runtimeModules,
    outbase: Path.resolve(__dirname, '../src/runtime/'),
    outdir: Path.resolve(__dirname, '../dist'),
    platform: 'neutral',
    plugins: [
      {
        name: 'resolve_node_esm_uris',
        setup(build) {
          build.onResolve({ filter: /^node:/, namespace: 'file' }, ({ path }) => {
            return {
              path: path.slice(5),
              external: true,
            };
          });
        },
      },
    ],
    sourcemap: false,
    splitting: true,
    write: true,
  });
}

async function buildRuntimeTypes() {
  /** @type {Extract<import('rollup').InputOption, {}>} */
  const runtimeInput = {};
  /** @type {Promise<void>[]} */
  const buildPromises = [];

  for (const runtimeModuleName of runtimeModuleNames) {
    buildPromises.push(
      (async () => {
        const build = await rollup({
          input: {
            [`${runtimeModuleName}/index`]: Path.resolve(
              __dirname,
              `../src/runtime/${runtimeModuleName}/index.ts`
            ),
          },
          external: (name) => !name.startsWith('.') && !name.startsWith('/'),
          plugins: [
            RollupPluginNodeResolve(),
            RollupPluginTs({
              hook: {
                declarationStats(stats) {
                  for (const typeDefinitionName of Object.keys(stats)) {
                    const { externalTypes } = stats[typeDefinitionName];

                    for (const { library, version } of externalTypes) {
                      const versionSpec = mergedDependencies[library] || version;

                      if (devDependencies[library] && devDependencies[library] !== versionSpec) {
                        throw new Error(
                          `Internal inconsistency between required type versions for ${library}`
                        );
                      }

                      devDependencies[library] = versionSpec;
                    }
                  }

                  // Needed to satisfy @ts-check :shrug:
                  return undefined;
                },
              },
              // We want to get ESNext and let the transformation / minification
              // happen at build time
              transpiler: 'typescript',
              transpileOnly: true,
            }),
          ],
        });

        const outDir = Path.resolve(__dirname, `../dist/`);
        const buildResult = await build.generate({
          dir: outDir,
          format: 'esm',
          esModule: true,
          sourcemap: false,
        });

        for (const chunk of buildResult.output) {
          if (chunk.type === 'asset') {
            const fileName = Path.resolve(outDir, chunk.fileName);

            await Fs.mkdir(Path.dirname(fileName), { recursive: true });
            await Fs.writeFile(fileName, chunk.source);
          }
        }
      })()
    );
  }

  await Promise.all(buildPromises);
}

(async () => {
  if (!builtinModules.includes('worker_threads')) {
    console.error(
      `❌ Building Nostalgie requires Node version ${JSON.stringify(
        PackageJson.engines.node
      )}. Please check your version, you appear to be running ${JSON.stringify(process.version)}.`
    );

    process.exit(1);
  }

  const service = await startService();
  try {
    if (!process.env.SKIP_EMPTY) {
      await Fs.rmdir(Path.resolve(__dirname, '../dist'), { recursive: true });
    }

    await Fs.mkdir(Path.resolve(__dirname, '../dist/bin'), { recursive: true });

    const buildPromises = [
      buildCli(service),
      buildMdxCompilerWorker(service),
      buildPiscinaWorker(service),
      buildRuntimeModules(service),
      Fs.copyFile(typesPath, Path.resolve(__dirname, '../dist/index.d.ts')),
      Fs.copyFile(nostalgieBinPath, Path.resolve(__dirname, '../dist/bin/nostalgie')),
      Fs.copyFile(nostalgieCmdPath, Path.resolve(__dirname, '../dist/bin/nostalgie.cmd')),
      Fs.copyFile(readmePath, Path.resolve(__dirname, '../dist/README.md')),
      Fs.copyFile(licensePath, Path.resolve(__dirname, '../dist/LICENSE')),
    ];

    if (!process.env.SKIP_TYPES_BUILD) {
      buildPromises.push(buildRuntimeTypes());
    }

    await Promise.all(buildPromises);

    const dependencies = {
      // For some reason the type dependency is not being detected for this so
      // let's hard-code it in. We need this as an explicit dependency so that types are available
      // for routing-related stuff.
      '@types/react-router-dom': PackageJson.devDependencies['@types/react-router-dom'],
    };
    const peerDependencies = {};

    for (const externalName of externalModules) {
      const target =
        externalName === 'react' || externalName === 'react-dom' ? peerDependencies : dependencies;
      const versionSpec = mergedDependencies[externalName];
      if (externalName.includes('react-router'))
        console.debug({
          externalName,
          mergedDependencies,
          target: target === peerDependencies ? 'peerDependencies' : 'dependencies',
          mergedSpec: versionSpec,
        });

      if (versionSpec) {
        target[externalName] = versionSpec;
      }
    }

    for (const runtimeModuleName of runtimeModuleNames) {
      exportMap[`./${runtimeModuleName}`] = `./${runtimeModuleName}/index.js`;
    }

    const promises = [
      (async () => {
        await Fs.mkdir(Path.resolve(__dirname, '../dist/themes'), { recursive: true });
        await Fs.copyFile(
          Path.resolve(__dirname, '../src/themes/OneDark.json'),
          Path.resolve(__dirname, '../dist/themes/OneDark.json')
        );
      })(),
    ];

    promises.push(
      Fs.writeFile(
        Path.resolve(__dirname, '../dist/package.json'),
        JSON.stringify(
          {
            name: PackageJson.name,
            version: PackageJson.version,
            description: PackageJson.description,
            types: './index.d.ts',
            exports: exportMap,
            bin: {
              nostalgie: './bin/nostalgie',
            },
            dependencies,
            devDependencies,
            peerDependencies,
            repository: PackageJson.repository,
            keywords: PackageJson.keywords,
            author: PackageJson.author,
            license: PackageJson.license,
            bugs: PackageJson.bugs,
            homepage: PackageJson.homepage,
            engines: PackageJson.engines,
            engineStrict: PackageJson.engineStrict,
          },
          null,
          2
        )
      )
    );

    for (const runtimeModuleName of runtimeModuleNames) {
      const packageJsonPath = Path.resolve(__dirname, `../dist/${runtimeModuleName}/package.json`);

      promises.push(
        Fs.writeFile(
          packageJsonPath,
          JSON.stringify(
            {
              name: `nostalgie-${runtimeModuleName}`,
              version: PackageJson.version,
              private: true,
              type: 'module',
              main: './index.js',
              module: './index.js',
              types: './index.d.ts',
              license: PackageJson.license,
            },
            null,
            2
          )
        )
      );
    }

    await Promise.all(promises);
  } finally {
    service.stop();

    // await Fs.rmdir('../dist/meta', { recursive: true });
  }
})().catch((err) => {
  console.trace(err);
  process.exit(1);
});
