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
        signal.onabort = () => service.stop();

        await build({ logger, service, settings });
      });
    }
  );
}
