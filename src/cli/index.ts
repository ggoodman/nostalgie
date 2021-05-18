//@ts-ignore
// const logPromise = import('why-is-node-running');

import Debug from 'debug';
import * as Path from 'path';
import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { buildProject } from '../build';
import { readConfigs } from '../config';
import { Background } from '../context';
import { runDevServer } from '../dev';
import { createDefaultLogger } from '../logging';

const debug = Debug.debug('nostalgie:cli');

Yargs(hideBin(process.argv))
  .help()
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
      const logger = createDefaultLogger();
      const { cancel, context } = Background.withCancel();
      const exitSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

      for (const signal of exitSignals) {
        process.once(signal, (signal) => {
          debug('signal received: %s', signal);
          logger.onExitSignalReceived(signal);
          cancel();
        });
      }

      for await (const {
        context: configContext,
        config,
      } of await readConfigs(
        context,
        logger,
        Path.resolve(process.cwd(), argv.project_root || '.'),
        { watch: false }
      )) {
        try {
          await buildProject(configContext, logger, config);
        } catch (err) {
          debug('build error: %O', err);
        } finally {
          cancel();
        }
      }
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
            description:
              'The port on which you want the nostalgie dev server to run.',
            default: 8080,
          },
          'log-level': {
            description: 'Change the verbosity of logs produced by the CLI.',
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
          },
          'disable-hot-reload': {
            boolean: true,
            description:
              'Disable the automatic reload behaviour when running in development mode.',
          },
        } as const),
    async (argv) => {
      const logger = createDefaultLogger();
      const { cancel, context } = Background.withCancel();
      const exitSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

      for (const signal of exitSignals) {
        process.once(signal, (signal) => {
          debug('signal received: %s', signal);
          logger.onExitSignalReceived(signal);
          cancel();
        });
      }

      // 1. Resolve the config file
      // 2. Validate the config file and set defaults
      // 3. Set-up config watcher and on each change:
      //   a. Validate the config file and set defaults
      //   b. (Re)start the dev server with the updated list of plugins
      let runCount = 0;

      for await (const {
        context: configContext,
        config,
      } of await readConfigs(
        context,
        logger,
        Path.resolve(process.cwd(), argv.project_root || '.'),
        { watch: true }
      )) {
        try {
          debug('obtained config %d', runCount);
          await runDevServer(configContext, logger, ++runCount, config);
        } catch (err) {
          debug('runDevServer error: %O', err);

          await new Promise(configContext.onDidCancel.bind(configContext));
        }
      }
    }
  ).argv;
