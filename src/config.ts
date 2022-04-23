import { withCancel, type Context } from '@ggoodman/context';
import { makeAsyncIterableIteratorFromSink } from '@n1ru4l/push-pull-async-iterable-iterator';
import { build, type BuildResult } from 'esbuild';
import * as Path from 'path';
import { Array, Optional, Record, String } from 'runtypes';
import { invariant } from './invariant';
import type { Logger } from './logging';
import type { Plugin } from './plugin';

const NostalgieUserConfigSchema = Record({
  appEntrypoint: String,
  plugins: Optional(
    Array(
      Record({
        name: String,
      })
    )
  ),
  rootDir: Optional(String),
});

export interface NostalgieUserConfig {
  /**
   * Path to the front-end application's entrypoint relative to the
   * project root.
   */
  appEntrypoint: string;

  /**
   * Array of Nostalgie Full-Stack plugins.
   */
  plugins?: Plugin[];

  /**
   * Path to the root directory of your project. Most paths
   * can be specified relative to this directory. When not
   * specified, it will be inferred as the directory of your
   * config file.
   */
  rootDir?: string;
}

export interface NostalgieConfig extends Required<NostalgieUserConfig> {}

export interface ReadConfigOptions {
  env?: 'development' | 'produciton';
  watch?: boolean;
}

export function defineConfig(config: NostalgieUserConfig): NostalgieUserConfig {
  const validationResult = NostalgieUserConfigSchema.validate(config);

  if (!validationResult.success) {
    throw new Error(validationResult.message);
  }

  return {
    appEntrypoint: config.appEntrypoint,
    rootDir: config.rootDir,
    plugins: config.plugins,
  };
}

export function readConfigs(
  ctx: Context,
  logger: Logger,
  rootDir: string,
  options: Readonly<ReadConfigOptions> = {}
): AsyncIterable<{ config: NostalgieConfig; context: Context }> {
  return makeAsyncIterableIteratorFromSink<{
    config: NostalgieConfig;
    context: Context;
  }>((sink) => {
    let childCtx = withCancel(ctx);

    ctx.onDidCancel(() => sink.complete());

    const onBuildResult = (buildResult: BuildResult) => {
      const config = instantiateConfig(logger, rootDir, buildResult);

      if (config) {
        childCtx.cancel();
        childCtx = withCancel(ctx);

        sink.next({ config, context: childCtx.ctx });
      }
    };

    build({
      absWorkingDir: rootDir,
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(options.env ?? 'production'),
        __filename: '"nostalgie.config.js"',
      },
      conditions: ['require'],
      mainFields: ['main'],
      entryPoints: {
        config: './nostalgie.config',
      },
      external: ['esbuild'],
      format: 'cjs',
      metafile: true,
      platform: 'node',
      target: `node${process.version.slice(1)}`,
      treeShaking: true,
      watch: options.watch
        ? {
            onRebuild: (err, result) => {
              if (ctx.error()) {
                return;
              }
              if (err) {
                logger.onConfigLoadError(err);
              } else if (result) {
                onBuildResult(result);
              }
            },
          }
        : undefined,
      write: false,
    }).then(
      (buildResult) => {
        onBuildResult(buildResult);
      },
      (err) => {
        // Initial build failed. Nothing to watch so let's throw.
        logger.onConfigLoadError(err);
        sink.error(err);
      }
    );

    return () => childCtx.cancel();
  });
}

function instantiateConfig(
  logger: Logger,
  rootDir: string,
  buildResult: BuildResult
): NostalgieConfig | undefined {
  const outputFiles = buildResult.outputFiles;

  invariant(outputFiles, 'Build results must have output files.');
  invariant(
    outputFiles.length === 1,
    'Build results must have a single output file.'
  );

  try {
    const mod = { exports: {} };
    const instantiate = new Function(
      'module',
      'exports',
      'require',
      outputFiles[0].text
    );

    instantiate(mod, mod.exports, require);

    const userSettings = (mod.exports as any).default;
    const validationResult = NostalgieUserConfigSchema.validate(userSettings);
    const fileName = Path.resolve(
      rootDir,
      buildResult.metafile!.outputs['config.js'].entryPoint!
    );

    if (validationResult.success) {
      return {
        appEntrypoint: validationResult.value.appEntrypoint,
        plugins: validationResult.value.plugins ?? [],
        rootDir,
      };
    }

    logger.onConfigValidationError(fileName, validationResult);
  } catch (err: any) {
    logger.onConfigLoadError(err);
  }
}
