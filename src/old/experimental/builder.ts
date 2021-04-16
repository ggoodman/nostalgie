import { build } from 'esbuild';
import * as Path from 'path';

interface BuilderPlugin {}

export interface AssetBuilderOptions {
  cwd?: string;
  entrypoint: string;
  nodeEnv?: string;
  plugins?: BuilderPlugin[];
}

export class AssetBuilder {
  private readonly cwd: string;
  private readonly entrypoint: string;
  private readonly nodeEnv: string;
  private readonly plugins: BuilderPlugin[];

  constructor(options: AssetBuilderOptions) {
    this.cwd = options.cwd ?? '.';
    this.entrypoint = options.entrypoint;
    this.nodeEnv = options.nodeEnv ?? 'production';
    this.plugins = options.plugins ?? [];
  }

  async start() {
    const initialBuildResult = await build({
      absWorkingDir: Path.resolve(process.cwd(), this.cwd),
      assetNames: 'assets/[dir]/[name]-[hash]',
      conditions: ['module', 'browser', 'default'],
      define: {
        'process.env.NODE_ENV': JSON.stringify(this.nodeEnv),
      },
      chunkNames: 'chunks/[dir]/[name]-[hash]',
      entryNames: '[name]-[hash]',
      entryPoints: [this.entrypoint],
      format: 'esm',
      mainFields: ['module', 'browser', 'main'],
      outdir: '/',
      platform: 'neutral',
      publicPath: '',
      resolveExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      splitting: true,
      target: 'es2019',
      treeShaking: true,
      watch: {
        onRebuild: (err, result) => {
          console.log('onRebuild', err, result);
        },
      },
      write: false,
    });

    console.log('onInitialBuild', initialBuildResult);
  }
}
