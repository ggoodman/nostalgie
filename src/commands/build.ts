import * as Path from 'path';
import { build } from '../build';
import type { CommandHost } from '../command';
import { readNormalizedSettings } from '../settings';

export function setup(commandHost: CommandHost) {
  commandHost.registerNamedCommand(
    {
      name: 'build',
      description: 'Build your nostalgie app',
      options: {
        env: {
          choices: ['development', 'production'],
          description: 'The environment for which you want to build your nostalgie server and app.',
          default: 'development',
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

      await build(settings);
    }
  );
}
