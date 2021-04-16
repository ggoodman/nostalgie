import { AssetBuilder } from './builder';

async function main() {
  const builder = new AssetBuilder({
    cwd: __dirname,
    entrypoint: './builder/App.tsx',
  });

  await builder.start();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
