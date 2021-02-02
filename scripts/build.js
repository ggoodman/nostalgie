//@ts-check

const ChildProcess = require('child_process');
const { startService } = require('esbuild');
const Fs = require('fs').promises;
const { builtinModules } = require('module');
const { rollup } = require('rollup');
const RollupPluginDts = require('rollup-plugin-dts').default;
const Path = require('path');
const Util = require('util');

const PackageJson = require('../package.json');

const execAsync = Util.promisify(ChildProcess.execFile);

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
// Type definition modules for the 'externalModules'
const typeDependencyNames = ['@types/mdx-js__react', '@types/react-router-dom'];
const runtimeModuleNames = [
  'auth',
  'functions',
  'helmet',
  'lazy',
  'styling',
  'routing',
  'internal/bootstrap',
  'internal/inject-react',
  'internal/node-browser-apis',
  'internal/runtimes/node',
  'internal/server',
];

const typesPath = Path.resolve(__dirname, '../src/runtime/types.d.ts');
const nostalgieBinPath = Path.resolve(__dirname, '../src/cli/bin/nostalgie');
const nostalgieCmdPath = Path.resolve(__dirname, '../src/cli/bin/nostalgie.cmd');
const readmePath = Path.resolve(__dirname, '../README.md');
const licensePath = Path.resolve(__dirname, '../LICENSE');

// Fields we'll build up to produce our package.json
const exportMap = {};
const dependencies = {};
const devDependencies = {};
// We want to use the react version from the user's app (as long as it satisfies peerDep ranges)
const peerDependencies = {
  '@types/react': PackageJson.devDependencies['@types/react'],
  '@types/react-dom': PackageJson.devDependencies['@types/react-dom'],
};

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
    sourcemap: process.env.NODE_ENV === 'development',
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
    sourcemap: process.env.NODE_ENV === 'development',
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
    sourcemap: process.env.NODE_ENV === 'development',
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
    sourcemap: process.env.NODE_ENV === 'development',
    splitting: true,
    write: true,
  });
}

async function buildRuntimeTypes() {
  /** @type {Extract<import('rollup').InputOption, {}>} */
  const runtimeInput = {};
  /** @type {Promise<void>[]} */
  const buildPromises = [];

  await execAsync(Path.resolve(__dirname, '../node_modules/.bin/tsc'), ['--build', '--force'], {
    cwd: Path.resolve(__dirname, '../'),
  });

  for (const runtimeModuleName of runtimeModuleNames) {
    buildPromises.push(
      (async () => {
        const build = await rollup({
          input: Path.resolve(
            __dirname,
            `../dist/.types/src/runtime/${runtimeModuleName}/index.d.ts`
          ),
          external: (name) => !name.startsWith('.') && !name.startsWith('/'),
          plugins: [RollupPluginDts()],
        });

        const outFilePath = Path.resolve(__dirname, `../dist/${runtimeModuleName}/index.d.ts`);

        await build.write({
          file: outFilePath,
          format: 'esm',
        });
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

    promises.push(Fs.writeFile(Path.resolve(__dirname, '../dist/.npmignore'), '.types\n'));

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
