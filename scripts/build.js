//@ts-check

const ChildProcess = require('child_process');
const { build } = require('esbuild');
const Fs = require('fs').promises;
const { builtinModules } = require('module');
const { rollup } = require('rollup');
const RollupPluginDts = require('rollup-plugin-dts').default;
const Path = require('path');
const Util = require('util');

const PackageJson = require('../package.json');

const execAsync = Util.promisify(ChildProcess.execFile);

const externalModules = [
  'shiki',
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
// Type definition modules for the 'externalModules'
const typeDependencyNames = ['@types/mdx-js__react', '@types/react-router-dom'];
// const runtimeModuleNames = [
//   'auth',
//   'functions',
//   'markup',
//   'lazy',
//   'styling',
//   'routing',
//   'internal/bootstrap',
//   'internal/components',
//   'internal/inject-react',
//   'internal/node-browser-apis',
//   'internal/renderer',
//   'internal/runtimes/node',
// ];

const plugins = [Path.resolve(__dirname, '../src/runtime/plugins/')];

const typesPath = Path.resolve(__dirname, '../src/runtime/types.d.ts');
const nostalgieBinPath = Path.resolve(__dirname, '../src/cli/bin/nostalgie');
const nostalgieCmdPath = Path.resolve(
  __dirname,
  '../src/cli/bin/nostalgie.cmd'
);
const readmePath = Path.resolve(__dirname, '../README.md');
const licensePath = Path.resolve(__dirname, '../LICENSE');

// Fields we'll build up to produce our package.json
const exportMap = {
  // Explicitly export the package.json to simplify life for tooling authors
  './package.json': './package.json',
};
const dependencies = {};
const devDependencies = {};
// We want to use the react version from the user's app (as long as it satisfies peerDep ranges)
const peerDependencies = {
  react: '^16.8.0 || ^17.0.0',
  'react-dom': '^16.8.0 || ^17.0.0',
  '@types/react': '^16.8.0 || ^17.0.0',
  '@types/react-dom': '^16.8.0 || ^17.0.0',
};

const mergedDependencies = {
  ...(PackageJson.dependencies || {}),
  ...(PackageJson.devDependencies || {}),
};

// const metaPaths = {
//   cli: '../dist/meta/cli.json',
//   mdxCompilerWorker: '../dist/meta/mdxCompilerWorker.json',
//   piscinaWorker: '../dist/meta/piscinaWorker.json',
//   runtimeModules: '../dist/meta/runtimeModules.json',
// };

// All type definitions relied upon at runtime should be marked as "dependencies"
// per the TypeScript handbook: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#dependencies
for (const typeDependencyName of typeDependencyNames) {
  const range = PackageJson.devDependencies[typeDependencyName];

  if (!range) {
    throw new Error(
      `Invariant violation: Expected ${typeDependencyName} to be in the devDependencies field of package.json`
    );
  }

  dependencies[typeDependencyName] = range;
}

async function buildCli() {
  await build({
    bundle: true,
    external: externalModules,
    // conditions: ['require', 'node'],
    define: {
      // 'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.url': 'import_meta_url',
    },
    entryPoints: [Path.resolve(__dirname, '../src/cli/index.ts')],
    format: 'cjs',
    inject: [Path.resolve(__dirname, './inject.js')],
    loader: {
      '.node': 'binary',
    },
    logLevel: 'error',
    // mainFields: ['main'],
    minify: false,
    outfile: Path.resolve(__dirname, '../dist/cli.js'),
    platform: 'node',
    plugins: [externalize(externalModules)],
    target: 'node10.16',
    splitting: false,
    sourcemap: process.env.NODE_ENV === 'development',
    treeShaking: true,
    write: true,
  });

  console.error(`✅ Built CLI`);
}

async function buildMdxCompilerWorker() {
  await build({
    bundle: true,
    external: externalModules,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: [Path.resolve(__dirname, '../src/worker/mdxCompiler.ts')],
    format: 'cjs',
    logLevel: 'error',
    outfile: Path.resolve(__dirname, '../dist/mdxCompilerWorker.js'),
    minify: process.env.NODE_ENV !== 'development',
    platform: 'node',
    target: 'node12.16',
    sourcemap: process.env.NODE_ENV === 'development',
    splitting: false,
    write: true,
  });
}

async function buildPiscinaWorker() {
  await build({
    bundle: true,
    external: externalModules,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    entryPoints: [Path.resolve(require.resolve('piscina'), '../worker.js')],
    format: 'cjs',
    logLevel: 'error',
    minify: process.env.NODE_ENV !== 'development',
    outfile: Path.resolve(__dirname, '../dist/worker.js'),
    platform: 'node',
    target: 'node12.16',
    sourcemap: process.env.NODE_ENV === 'development',
    splitting: false,
    write: true,
  });
}

async function buildRuntimeModules() {
  {
    /** @type {Record<string, string>} */
    const entryPoints = {};

    for (const spec in PackageJson.exports) {
      entryPoints[`${spec.slice(2)}/index.esm`] = PackageJson.exports[spec];
    }

    await build({
      assetNames: 'assets/[name]-[hash]',
      bundle: true,
      chunkNames: 'chunks/[name]-[hash]',
      conditions: ['import'],
      external: externalModules,
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV ?? 'production'
        ),
      },
      entryPoints,
      format: 'esm',
      logLevel: 'error',
      mainFields: ['module', 'main'],
      outdir: Path.resolve(__dirname, '../dist'),
      platform: 'neutral',
      plugins: [
        {
          name: 'resolve_node_esm_uris',
          setup(build) {
            build.onResolve(
              { filter: /^node:/, namespace: 'file' },
              ({ path }) => {
                return {
                  path: path.slice(5),
                  external: true,
                };
              }
            );
          },
        },
      ],
      sourcemap: process.env.NODE_ENV === 'development',
      splitting: true,
      target: 'node12',
      write: true,
    });

    console.error(`✅ Built ESM`);
  }
  {
    /** @type {Record<string, string>} */
    const entryPoints = {};

    for (const spec in PackageJson.exports) {
      entryPoints[`${spec.slice(2)}/index.cjs`] = PackageJson.exports[spec];
    }

    await build({
      assetNames: 'assets/[name]-[hash]',
      bundle: true,
      chunkNames: 'chunks/[name]-[hash]',
      conditions: ['import'],
      external: externalModules,
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV ?? 'production'
        ),
      },
      entryPoints,
      format: 'cjs',
      logLevel: 'error',
      mainFields: ['module', 'main'],
      outdir: Path.resolve(__dirname, '../dist'),
      platform: 'neutral',
      plugins: [
        {
          name: 'resolve_node_esm_uris',
          setup(build) {
            build.onResolve(
              { filter: /^node:/, namespace: 'file' },
              ({ path }) => {
                return {
                  path: path.slice(5),
                  external: true,
                };
              }
            );
          },
        },
      ],
      sourcemap: process.env.NODE_ENV === 'development',
      splitting: false,
      target: 'node12',
      write: true,
    });

    console.error(`✅ Built CJS`);
  }

  for (const spec in PackageJson.exports) {
    if (spec !== '.') {
      await Fs.writeFile(
        Path.resolve(__dirname, '../dist', spec, 'package.json'),
        JSON.stringify(
          {
            main: './index.cjs.js',
            module: './index.esm.js',
            types: './index.d.ts',
            exports: {
              import: './index.esm.js',
              require: './index.cjs.js',
              default: './index.cjs.js',
            },
          },
          null,
          2
        )
      );
      console.error(`✅ Package manifest written for %s`, spec.slice(2));
    }
  }
}

async function buildRuntimeTypes() {
  /** @type {Extract<import('rollup').InputOption, {}>} */
  const runtimeInput = {};
  /** @type {Promise<void>[]} */
  const buildPromises = [];

  await execAsync(
    Path.resolve(__dirname, '../node_modules/.bin/tsc'),
    ['--build', '--force', '--incremental'],
    {
      cwd: Path.resolve(__dirname, '../'),
    }
  );

  console.error(`✅ Type check completed`);

  for (const runtimeModuleName in PackageJson.exports) {
    const entrypointAsDTs = PackageJson.exports[runtimeModuleName].replace(
      /\.ts$/,
      '.d.ts'
    );

    buildPromises.push(
      (async () => {
        const build = await rollup({
          input: Path.resolve(__dirname, `../dist/.types/`, entrypointAsDTs),
          external: (name) => !name.startsWith('.') && !name.startsWith('/'),
          plugins: [RollupPluginDts()],
        });

        const outFilePath = Path.resolve(
          __dirname,
          `../dist/${runtimeModuleName.slice(2)}/index.d.ts`
        );

        await build.write({
          file: outFilePath,
          format: 'esm',
        });

        console.error(`✅ Types written for %s`, runtimeModuleName);
      })()
    );
  }

  await Promise.all(buildPromises);
}

function createPackageJson() {
  invariant(PackageJson.exports, `Your package.json is missing .exports`);
  const mainExport = PackageJson.exports['.'];
  invariant(mainExport, `Your package.json is missing .exports['.']`);

  const combinedDeps = {
    ...PackageJson.devDependencies,
    ...PackageJson.dependencies,
  };

  const exportsMap = {};

  for (const exportName in PackageJson.exports) {
    exportsMap[exportName] = {
      require: `${exportName}/index.cjs.js`,
      import: `${exportName}/index.esm.js`,
      default: `${exportName}/index.cjs.js`,
    };
  }

  return {
    name: PackageJson.name,
    version: PackageJson.version,
    description: PackageJson.description,
    main: './dist/index.cjs.js',
    module: './dist/index.esm.js',
    exports: exportsMap,
    scripts: {},
    devDependencies: Object.keys(combinedDeps)
      .filter((depName) => !externalModules.includes(depName))
      .reduce((devDeps, depName) => {
        return {
          ...devDeps,
          [depName]: combinedDeps[depName],
        };
      }, {}),
    dependencies: Object.keys(combinedDeps)
      .filter((depName) => externalModules.includes(depName))
      .reduce((deps, depName) => {
        return {
          ...deps,
          [depName]: combinedDeps[depName],
        };
      }, {}),
    repository: PackageJson.repository,
    keywords: PackageJson.keywords,
    author: PackageJson.author,
    license: PackageJson.license,
    bugs: PackageJson.bugs,
    homepage: PackageJson.homepage,
    engines: PackageJson.engines,
    engineStrict: PackageJson.engineStrict,
    volta: PackageJson.volta,
  };
}

(async () => {
  if (!builtinModules.includes('worker_threads')) {
    console.error(
      `❌ Building Nostalgie requires Node version ${JSON.stringify(
        PackageJson.engines.node
      )}. Please check your version, you appear to be running ${JSON.stringify(
        process.version
      )}.`
    );

    process.exit(1);
  }

  if (!process.env.SKIP_EMPTY) {
    await Fs.rmdir(Path.resolve(__dirname, '../dist'), { recursive: true });
  }

  await Fs.mkdir(Path.resolve(__dirname, '../dist/bin'), { recursive: true });

  const buildPromises = [
    buildCli(),
    // buildMdxCompilerWorker(service),
    // buildPiscinaWorker(service),
    buildRuntimeTypes(),
    buildRuntimeModules(),
    // Fs.copyFile(typesPath, Path.resolve(__dirname, '../dist/index.d.ts')),
    Fs.copyFile(
      nostalgieBinPath,
      Path.resolve(__dirname, '../dist/bin/nostalgie')
    ),
    Fs.copyFile(
      nostalgieCmdPath,
      Path.resolve(__dirname, '../dist/bin/nostalgie.cmd')
    ),
    Fs.copyFile(readmePath, Path.resolve(__dirname, '../dist/README.md')),
    Fs.copyFile(licensePath, Path.resolve(__dirname, '../dist/LICENSE')),
    Fs.writeFile(
      Path.resolve(__dirname, '../dist/package.json'),
      JSON.stringify(createPackageJson(), null, 2)
    ),
  ];

  // if (!process.env.SKIP_TYPES_BUILD) {
  //   buildPromises.push(buildRuntimeTypes());
  // }

  await Promise.all(buildPromises);
})().catch((err) => {
  console.trace(err);
  process.exit(1);
});

/**
 *
 * @param {unknown} check
 * @param {string} message
 * @returns {asserts check}
 */
function invariant(check, message) {
  if (!check) {
    const err = new Error(`Invariant violation: ${message}`);

    Error.captureStackTrace(err, invariant);

    throw err;
  }
}

/**
 *
 * @param {string[]} externals
 * @returns {import('esbuild').Plugin}
 */
function externalize(externals) {
  return {
    name: 'externalize-plugin',
    setup(build) {
      const externalsSet = new Set(externals);

      build.onResolve({ filter: /.*/, namespace: 'file' }, (args) => {
        if (externalsSet.has(args.path)) {
          return {
            external: true,
          };
        }
      });
    },
  };
}
