require('esbuild')
  .build({
    bundle: true,
    entryPoints: ['./src/worker/mdxCompiler.ts'],
    external: [],
    format: 'cjs',
    outfile: './dist/mdxCompilerWorker.js',
    platform: 'node',
    plugins: [bareModuleExternalPlugin()],
    target: 'node10',
    write: true,
  })
  .then(
    () => {
      console.error('✅ Successfully compiled the MDX compiler worker');
    },
    (err) => {
      console.error('❌ Error while building the MDX compiler worker:', err.message);
    }
  );

/**
 * @returns {import('esbuild').Plugin}
 */
function bareModuleExternalPlugin() {
  return {
    name: 'bare-module-external',
    setup(build) {
      build.onResolve({ filter: /^[^/.]/, namespace: 'file' }, async () => {
        return {
          external: true,
        };
      });
    },
  };
}
