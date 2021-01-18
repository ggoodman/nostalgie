import RollupPluginCommonJs from '@rollup/plugin-commonjs';
import RollupPluginNodeResolve from '@rollup/plugin-node-resolve';
import RollupPluginTs from '@wessberg/rollup-plugin-ts';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import * as PackageJson from './package.json';

const BARE_MODULE_SPEC_RX = /^((@[^/]+\/[^/@]+|[^./@][^/@]*))(.*)?$/;

/** @type {import('@wessberg/rollup-plugin-ts').DeclarationStats} */
let declarationStats = {};

const runtimeModuleNames = ['bootstrap', 'functions', 'helmet', 'lazy', 'routing', 'server'];

/** @type {Extract<import('rollup').InputOption, {}>} */
const runtimeInput = {};

for (const runtimeModuleName of runtimeModuleNames) {
  runtimeInput[`${runtimeModuleName}/index`] = Path.resolve(
    __dirname,
    `./src/runtime/${runtimeModuleName}/index.ts`
  );
}

const typesPath = Path.resolve(__dirname, './src/runtime/types.d.ts');
const nostalgieBinPath = Path.resolve(__dirname, './src/cli/bin/nostalgie');
const nostalgieCmdPath = Path.resolve(__dirname, './src/cli/bin/nostalgie.cmd');
const readmePath = Path.resolve(__dirname, 'README.md');
const licensePath = Path.resolve(__dirname, 'LICENSE');

/** @type {import("rollup").RollupOptions[]} */
const config = [
  // CLI
  {
    input: Path.resolve(__dirname, './src/cli.ts'),
    output: {
      file: Path.resolve(__dirname, './dist/cli.js'),
      format: 'commonjs',
    },
    external: (spec) => !spec.startsWith('.') && !spec.startsWith('/'),
    plugins: [
      RollupPluginNodeResolve(),
      RollupPluginCommonJs(),
      RollupPluginTs({
        // This actually runs in node, we need this to be compatible
        browserslist: ['maintained node versions'],
        transpiler: 'babel',
      }),
    ],
  },
  // MDX Compiler Worker
  {
    input: Path.resolve(__dirname, './src/worker/mdxCompiler.ts'),
    output: {
      file: Path.resolve(__dirname, './dist/mdxCompilerWorker.js'),
      format: 'commonjs',
    },
    external: (spec) => !spec.startsWith('.') && !spec.startsWith('/'),
    plugins: [
      RollupPluginNodeResolve(),
      RollupPluginCommonJs(),
      RollupPluginTs({
        // This actually runs in node, we need this to be compatible
        browserslist: ['maintained node versions'],
        transpiler: 'babel',
      }),
    ],
  },
  // Runtime library
  {
    input: runtimeInput,
    output: {
      dir: Path.resolve('./dist'),
      format: 'esm',
      esModule: true,
      externalLiveBindings: false,
      sourcemap: true,
    },
    external: (spec) => !spec.startsWith('.') && !spec.startsWith('/'),
    plugins: [
      RollupPluginNodeResolve(),
      RollupPluginCommonJs(),
      RollupPluginTs({
        hook: {
          declarationStats(stats) {
            declarationStats = stats;
          },
        },
        // We want to get ESNext and let the transformation / minification
        // happen at build time
        transpiler: 'typescript',
      }),
      {
        name: 'package.json',
        buildStart() {
          // Terrible hack but we don't have a way to inject the declarationStats
          // into Rollup's context (that I know of).
          declarationStats = {};

          this.addWatchFile(typesPath);
          this.addWatchFile(nostalgieBinPath);
          this.addWatchFile(nostalgieCmdPath);
          this.addWatchFile(readmePath);
          this.addWatchFile(licensePath);
        },
        async writeBundle(options, bundle) {
          /** @type {Record<string, string>} */
          const dependencies = {};
          const devDependencies = {};

          for (const chunkName of Object.keys(bundle)) {
            const chunk = bundle[chunkName];

            if (chunk.type === 'asset') {
              continue;
            }

            for (const moduleNameSpec of chunk.imports) {
              const matches = moduleNameSpec.match(BARE_MODULE_SPEC_RX);

              if (!matches) {
                continue;
              }

              const [, moduleName] = matches;

              if (moduleName in bundle) {
                // We don't care about internal dependencies
                continue;
              }

              // The dependency will be injected at runtime
              if (moduleName.startsWith('__nostalgie_')) {
                continue;
              }

              const moduleSpecifier =
                PackageJson.dependencies[moduleName] || PackageJson.devDependencies[moduleName];

              if (!moduleSpecifier) {
                throw new Error(
                  `The runtime bundle depends on ${moduleName} but the version string could not be found in the root package.json`
                );
              }

              dependencies[moduleName] = moduleSpecifier;
            }
          }

          for (const typeDefinitionName of Object.keys(declarationStats)) {
            const { externalTypes } = declarationStats[typeDefinitionName];

            for (const { library, version } of externalTypes) {
              if (devDependencies[library] && devDependencies[library] !== version) {
                throw new Error(
                  `Internal inconsistency between required type versions for ${library}`
                );
              }

              devDependencies[library] = version;
            }
          }

          /** @type {Promise<unknown>[]} */
          const promises = [];

          promises.push(
            Fs.writeFile(
              Path.resolve(__dirname, './dist/package.json'),
              JSON.stringify(
                {
                  name: PackageJson.name,
                  version: PackageJson.version,
                  description: PackageJson.description,
                  exports: {
                    './bootstrap': './bootstrap/index.js',
                    './functions': './functions/index.js',
                    './helmet': './helmet/index.js',
                    './lazy': './lazy/index.js',
                    './routing': './routing/index.js',
                    './server': './server/index.js',
                  },
                  bin: {
                    nostalgie: './bin/nostalgie',
                  },
                  dependencies,
                  devDependencies,
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
            const packageJsonPath = Path.resolve(
              __dirname,
              `./dist/${runtimeModuleName}/package.json`
            );

            promises.push(
              Fs.writeFile(
                packageJsonPath,
                JSON.stringify(
                  {
                    name: `nostalgie-${runtimeModuleName}`,
                    version: PackageJson.version,
                    private: true,
                    module: true,
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

          await Fs.mkdir(Path.resolve(__dirname, './dist/bin'), { recursive: true });

          promises.push(
            ...[
              Fs.copyFile(typesPath, Path.resolve(__dirname, './dist/index.d.ts')),
              Fs.copyFile(nostalgieBinPath, Path.resolve(__dirname, './dist/bin/nostalgie')),
              Fs.copyFile(nostalgieCmdPath, Path.resolve(__dirname, './dist/bin/nostalgie.cmd')),
              Fs.copyFile(readmePath, Path.resolve(__dirname, './dist/README.md')),
              Fs.copyFile(licensePath, Path.resolve(__dirname, './dist/LICENSE')),
            ]
          );

          await Promise.all(promises);
        },
      },
    ],
  },
];

export default config;
