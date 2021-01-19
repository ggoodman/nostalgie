//@ts-ignore
// const logPromise = import('why-is-node-running');

import { watch } from 'chokidar';
import { startService } from 'esbuild';
import { builtinModules } from 'module';
import * as Path from 'path';
import type { Logger } from 'pino';
import Yargs from 'yargs';
import PackageJson from '../../package.json';
import { wireAbortController, withCleanup } from '../lifecycle';
import { createDefaultLogger } from '../logging';
import { readNormalizedSettings } from '../settings';

Yargs.help()
  .demandCommand()
  .recommendCommands()
  .strict()
  .showHelpOnFail(false)
  .command(
    'build',
    'Create a build of your nostalgie app',
    (yargs) =>
      yargs.options({
        env: {
          choices: ['development', 'production'],
          description: 'The environment for which you want to build your nostalgie server and app.',
          default: 'production',
        },
        'root-dir': {
          string: true,
          description: 'The root of your nostalgie project',
        },
      } as const),
    async (argv) => {
      const logger = createDefaultLogger();

      versionCheck('build', logger);

      const { abort, signal } = wireAbortController(logger);
      const cwd = process.cwd();
      const settings = await readNormalizedSettings({
        rootDir: Path.resolve(cwd, argv['root-dir'] ?? './'),
        buildEnvironment: argv.env,
      });

      await withCleanup(async (defer) => {
        // ESBuild works based on CWD :|
        const cwd = process.cwd();
        process.chdir(settings.rootDir);
        const service = await startService();
        process.chdir(cwd);
        defer(() => service.stop());
        signal.onabort = () => service.stop();
        defer(() => abort());

        const { build } = await import('../build');
        await build({ logger, service, settings, signal });
      });
    }
  )
  .command(
    'dev',
    'Start nostalgie in development mode',
    {
      env: {
        choices: ['development', 'production'],
        description: 'The environment for which you want to build your nostalgie server and app.',
        default: 'development',
      },
      host: {
        string: true,
        description:
          'The hostname or IP address to which you want to bind the nostalgie dev server.',
        default: 'localhost',
      },
      port: {
        number: true,
        description: 'The port on which you want the nostalgie dev server to run.',
        default: 8080,
      },
      'root-dir': {
        string: true,
        description: 'The root of your nostalgie project',
      },
    } as const,
    async (argv) => {
      const logger = createDefaultLogger();

      versionCheck('dev', logger);

      const { signal } = wireAbortController(logger);
      const cwd = process.cwd();
      const settings = await readNormalizedSettings({
        rootDir: Path.resolve(cwd, argv['root-dir'] ?? './'),
        buildEnvironment: argv.env,
      });

      await withCleanup(async (defer) => {
        // ESBuild works based on CWD :|
        const cwd = process.cwd();
        process.chdir(settings.rootDir);
        const service = await startService();
        process.chdir(cwd);
        defer(() => service.stop());

        const watcher = watch('.', {
          cwd: settings.rootDir,
          // atomic: true,
          // depth: 16,
          ignored: Path.resolve(settings.rootDir, './build'),
          // ignored: /\/(build|node_modules)\//,
          ignoreInitial: true,
          interval: 16,
          followSymlinks: false,
        });
        defer(() => watcher.close());

        const { build } = await import('../build');
        const { loadHapiServer, rebuild } = await build({ logger, service, settings, signal });
        const { startServer } = await loadHapiServer();
        const restartServer = () =>
          startServer({
            buildDir: settings.buildDir,
            host: argv.host,
            port: argv.port,
            logger,
            signal,
          });

        let serverStartPromise = restartServer();
        let rebuildDepth = 0;

        watcher.on('all', (eventName, path) => {
          rebuildDepth++;
          if (rebuildDepth <= 2) {
            logger.info(
              { eventName, path, rebuildDepth },
              'change detected, rebuilding and restarting'
            );

            // TODO: Fix type for lastServer when we're back under control
            serverStartPromise = serverStartPromise.then(async (lastServer: any) => {
              try {
                const rebuildPromise = rebuild();
                const stopPromise = lastServer.stop({ timeout: 5000 });

                await Promise.all([rebuildPromise, stopPromise]);

                return restartServer();
              } finally {
                rebuildDepth--;
              }
            });
          }
        });

        try {
          await serverStartPromise;
        } catch (err) {
          logger.error(err, 'Error while starting server');
          process.exit(1);
        }
        await new Promise((resolve) => {
          signal.onabort = resolve;
        });
      });
    }
  ).argv;

function versionCheck(cmd: string, logger: Logger) {
  if (!builtinModules.includes('worker_threads')) {
    logger.fatal(
      `The ${JSON.stringify(cmd)} command requires Node version ${JSON.stringify(
        PackageJson.engines.node
      )}, with support for "require('worker_threads')". Please check your version, you appear to be running ${JSON.stringify(
        process.version
      )}.`
    );

    process.exit(1);
  }
}
