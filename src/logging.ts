import Chalk from 'chalk';
import type { Failure } from 'runtypes';
import type { NostalgieConfig } from './config';
import { getErrorLinesWithCause } from './error';

export interface Logger {
  onConfigLoadError(err: Error): void;
  onConfigValidationError(filePath: string, failure: Failure): void;
  onServerListening(address: string): void;
  onValidConfiguration(config: NostalgieConfig): void;
  onExitSignalReceived(signal: NodeJS.Signals): void;
}

class TerminalLogger implements Logger {
  onConfigLoadError(err: Error) {
    console.error(
      `${Chalk.bold.redBright('!!')} Error loading the ${Chalk.bold(
        'nostalgie.conf.(js|ts)'
      )} file:`
    );
    console.error(
      Chalk.red(
        getErrorLinesWithCause(err, { indent: '   ', indentDepth: 1, indentString: '  ' }).join(
          '\n'
        )
      )
    );
    console.error(
      `${Chalk.dim.redBright('!!')} ${Chalk.dim('Waiting for the issues to be corrected...')}`
    );
  }

  onConfigValidationError(filePath: string, failure: Failure) {
    console.error(
      `${Chalk.bold.redBright('!!')} Failed to validate the config file ${Chalk.bold(
        'nostalgie.conf.(js|ts)'
      )} file:`
    );

    if (failure.details) {
      for (const field in failure.details) {
        const message = failure.details[field];

        console.error(Chalk.red(`     ${Chalk.bold(field)}: ${message}`));
      }
    } else {
      console.error(`     ${Chalk.red(failure.message)}.`);
    }
  }

  onExitSignalReceived(signal: NodeJS.Signals) {
    console.error(
      `${Chalk.bold.yellowBright('##')} Received signal ${Chalk.bold(signal)}, exiting...`
    );
  }

  onServerListening(address: string) {
    console.error(`${Chalk.bold.greenBright('++')} Server started at ${Chalk.bold(address)}`);
  }

  onValidConfiguration(config: NostalgieConfig) {
    console.error(`${Chalk.bold.greenBright('++')} Configuration reloaded.`);
  }
}

export function createDefaultLogger(): Logger {
  return new TerminalLogger();
}
