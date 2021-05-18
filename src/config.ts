import { makeAsyncIterableIteratorFromSink } from '@n1ru4l/push-pull-async-iterable-iterator';
import { build, BuildResult } from 'esbuild';
import * as Path from 'path';
import type { Context } from './context';
import { invariant } from './invariant';
import type { Logger } from './logging';
import { NostalgieSettings, validateSettings } from './settings';

export interface NostalgieConfig {
  fileName: string;
  rootDir: string;
  settings: NostalgieSettings;
}

export interface ReadConfigOptions {
  watch?: boolean;
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
    let childCtx = ctx.withCancel();

    ctx.onDidCancel(() => sink.complete());

    const onBuildResult = (buildResult: BuildResult) => {
      const config = instantiateConfig(logger, rootDir, buildResult);

      if (config) {
        childCtx.cancel();
        childCtx = ctx.withCancel();

        sink.next({ config, context: childCtx.context });
      }
    };

    build({
      absWorkingDir: rootDir,
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV ?? 'production'
        ),
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
              if (ctx.cancellationReason) {
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
  invariant(buildResult.outputFiles, 'Build results must have output files.');
  invariant(
    buildResult.outputFiles.length === 1,
    'Build results must have a single output file.'
  );

  try {
    const mod = { exports: {} };
    const instantiate = new Function(
      'module',
      'exports',
      'require',
      buildResult.outputFiles[0].text
    );

    instantiate(mod, mod.exports, require);

    const userSettings = (mod.exports as any).default;

    const validationResult = validateSettings(userSettings);
    const fileName = Path.resolve(
      rootDir,
      buildResult.metafile!.outputs['config.js'].entryPoint!
    );

    if (validationResult.success) {
      return {
        rootDir,
        fileName,
        settings: validationResult.value,
      };
    }

    logger.onConfigValidationError(fileName, validationResult);
  } catch (err) {
    logger.onConfigLoadError(err);
  }
}
