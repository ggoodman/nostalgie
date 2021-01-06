require('esbuild')
  .build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    external: [],
    format: 'cjs',
    outfile: './dist/cli.js',
    platform: 'node',
    plugins: [bareModuleExternalPlugin()],
    target: 'node10',
    write: true,
  })
  .then(
    () => {
      console.error('✅ Successfully compiled nostalgie CLI');
    },
    (err) => {
      console.error('❌ Error while building cli:', err.message);
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
