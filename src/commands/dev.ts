import * as Path from 'path';
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
          default: process.cwd(),
        },
      } as const,
    },
    async (argv) => {
      const settings = readNormalizedSettings({
        rootDir: Path.resolve(process.cwd(), argv['root-dir']),
        buildEnvironment: argv.env,
      });

      const { loadHapiServer } = await build(settings);
      const { logger, startServer } = loadHapiServer();

      await startServer(logger, {
        buildDir: settings.get('buildDir'),
        host: argv.host,
        port: argv.port,
      });
    }
  );
}
