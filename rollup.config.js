//@ts-check
const Rollup = require('rollup');
const RollupPluginDts = require('rollup-plugin-dts').default;

const runtimeModuleNames = [
  'auth',
  'functions',
  'helmet',
  'lazy',
  'routing',
  'internal/bootstrap',
  'internal/inject-react',
  'internal/node-browser-apis',
  'internal/runtimes/node',
  'internal/server',
];

/** @type {Rollup.RollupOptions[]} */
const configs = runtimeModuleNames.map((runtimeModuleName) => ({
  input: `./dts/src/runtime/${runtimeModuleName}/index.d.ts`,
  output: {
    file: `./dist/${runtimeModuleName}/index.d.ts`,
    format: 'esm',
  },
  plugins: [RollupPluginDts()],
}));

module.exports = configs;
