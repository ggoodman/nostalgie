//@ts-check
const ChildProcess = require('child_process');
const Util = require('util');
const Path = require('path');
const { promises: Fs } = require('fs');
const { rollup } = require('rollup');
/** @type {import('@wessberg/rollup-plugin-ts')} */
const RollupPluginTs = require('@wessberg/rollup-plugin-ts');
const RollupPluginNodeResolve = require('@rollup/plugin-node-resolve').nodeResolve;
const RollupPluginCommonJs = require('@rollup/plugin-commonjs');

rollup({
  input: {
    functions: Path.resolve(__dirname, '../src/runtime/functions/index.ts'),
    lazy: Path.resolve(__dirname, '../src/runtime/lazy/index.ts'),
    routing: Path.resolve(__dirname, '../src/runtime/routing/index.ts'),
    server: Path.resolve(__dirname, '../src/runtime/server.ts'),
  },
  plugins: [
    RollupPluginNodeResolve(),
    //@ts-ignore
    RollupPluginCommonJs(),
    //@ts-ignore
    RollupPluginTs({
      hook: {
        declarationStats: (declarationStats) => console.log(declarationStats),
      },
    }),
  ],
  external: (spec) => !spec.startsWith('.') && !spec.startsWith('/'),
})
  .then(async (build) => {
    const output = await build.write({
      dir: Path.resolve(__dirname, '../dist'),
      format: 'esm',
    });
    // const output = await build.generate({
    //   format: 'esm',
    //   dir: Path.resolve(__dirname, '../dist'),
    // });

    for (const chunk of output.output) {
      if (chunk.type === 'chunk') {
        console.log(chunk.modules);
        // await Fs.mkdir(Path.resolve(__dirname, '../dist'), { recursive: true });
        // await Fs.writeFile(Path.resolve(__dirname, '../dist', chunk.fileName), chunk.source);
      }
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
