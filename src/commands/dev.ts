import { watch } from 'chokidar';
import { startService } from 'esbuild';
import * as Path from 'path';
import { wireAbortController, withCleanup } from '../../runtime/server/lifecycle';
import { createDefaultLogger } from '../../runtime/server/logging';
import { build } from '../build';
import type { CommandHost } from '../command';
import { readNormalizedSettings } from '../settings';

export function setup(commandHost: CommandHost) {
  commandHost.registerNamedCommand(
    {
      name: 'dev',
      description: 'Start nostalgie in development mode',
      options: {
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
    },
    async (argv) => {
      const logger = createDefaultLogger();
      const signal = wireAbortController(logger);
      const cwd = process.cwd();
      const settings = readNormalizedSettings({
        rootDir: Path.resolve(cwd, argv['root-dir'] ?? './'),
        buildEnvironment: argv.env,
      });

      await withCleanup(async (defer) => {
        // ESBuild works based on CWD :|
        const cwd = process.cwd();
        process.chdir(settings.get('rootDir'));
        const service = await startService();
        process.chdir(cwd);
        defer(() => service.stop());

        const watcher = watch('.', {
          cwd: settings.get('rootDir'),
          // atomic: true,
          // depth: 16,
          ignored: Path.resolve(settings.get('rootDir'), './build'),
          // ignored: /\/(build|node_modules)\//,
          ignoreInitial: true,
          interval: 16,
          followSymlinks: false,
        });
        defer(() => watcher.close());

        const { loadHapiServer, rebuild } = await build({ logger, service, settings });
        const { startServer } = await loadHapiServer();
        const restartServer = () =>
          startServer(logger, {
            buildDir: settings.get('buildDir'),
            host: argv.host,
            port: argv.port,
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

            serverStartPromise = serverStartPromise.then(async (lastServer) => {
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

        await serverStartPromise;

        await new Promise((resolve) => {
          signal.onabort = resolve;
        });
      });
    }
  );
}
