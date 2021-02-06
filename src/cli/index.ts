//@ts-ignore
// const logPromise = import('why-is-node-running');

import { startService } from 'esbuild';
import Module from 'module';
import * as Path from 'path';
import type { Logger } from 'pino';
import { CancellationTokenSource } from 'ts-primitives';
import Yargs from 'yargs';
import PackageJson from '../../package.json';
import { wireAbortController, withCleanup } from '../lifecycle';
import { createDefaultLogger } from '../logging';
import { readNormalizedSettings } from '../settings';

const builtinModules = Module.builtinModules;

Yargs.help()
  .demandCommand()
  .recommendCommands()
  .strict()
  .showHelpOnFail(false)
  .command(
    'build [project_root]',
    'Create a build of your nostalgie app',
    (yargs) =>
      yargs
        .positional('project_root', {
          string: true,
          description: 'The root of your nostalgie project',
        } as const)
        .options({
          env: {
            choices: ['development', 'production'],
            description:
              'The environment for which you want to build your nostalgie server and app.',
            default: 'production',
          },
          'log-level': {
            description: 'Change the verbosity of logs produced by the CLI.',
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
          },
        } as const),
    async (argv) => {
      const logger = createDefaultLogger({ level: argv['log-level'] });

      versionCheck('build', logger);

      const { abort, signal } = wireAbortController(logger);
      const cwd = process.cwd();
      const settings = await readNormalizedSettings({
        rootDir: Path.resolve(cwd, argv.project_root ?? './'),
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

        const tokenSource = new CancellationTokenSource();
        signal.onabort = () => tokenSource.dispose(true);

        const { Builder } = await import('../build');
        const builder = new Builder({ logger, service, settings, token: tokenSource.token });
        await builder.build();
        process.exit(0);
      });
    }
  )
  .command(
    'dev [project_root]',
    'Start nostalgie in development mode',
    (yargs) =>
      yargs
        .positional('project_root', {
          string: true,
          description: 'The root of your nostalgie project',
        } as const)
        .options({
          env: {
            choices: ['development', 'production'],
            description:
              'The environment for which you want to build your nostalgie server and app.',
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
          'log-level': {
            description: 'Change the verbosity of logs produced by the CLI.',
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
          },
          'disable-hot-reload': {
            boolean: true,
            description: 'Disable the automatic reload behaviour when running in development mode.',
          },
        } as const),
    async (argv) => {
      const logger = createDefaultLogger({ level: argv['log-level'] });

      versionCheck('dev', logger);

      const { signal } = wireAbortController(logger);
      const cwd = process.cwd();
      const settings = await readNormalizedSettings({
        rootDir: Path.resolve(cwd, argv.project_root ?? './'),
        buildEnvironment: argv.env,
      });

      await withCleanup(async (defer) => {
        // ESBuild works based on CWD :|
        const cwd = process.cwd();
        process.chdir(settings.rootDir);
        const service = await startService();
        process.chdir(cwd);
        defer(() => service.stop());

        const tokenSource = new CancellationTokenSource();
        signal.onabort = () => tokenSource.dispose(true);

        const { Builder } = await import('../build');
        const builder = new Builder({ logger, service, settings, token: tokenSource.token });
        await builder.watch({
          automaticReload: argv['disable-hot-reload'] !== false,
          host: argv.host,
          port: argv.port,
          signal,
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
