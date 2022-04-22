import Chalk from 'chalk';
import type { Failure } from 'runtypes';
import type { NostalgieConfig } from './config';
import { getErrorLinesWithCause } from './error';
import type { RenderStats, Request } from './runtime/server';

export interface Logger {
  onConfigLoadError(err: Error): void;
  onConfigValidationError(filePath: string, failure: Failure): void;
  onServerListening(address: string): void;
  onServerRendered(options: {
    request: Request;
    errors: Error[];
    stats: RenderStats;
  }): void;
  onServerRenderError(err: Error): void;
  onValidConfiguration(config: NostalgieConfig): void;
  onExitSignalReceived(signal: NodeJS.Signals): void;
}

export class SilentLogger implements Logger {
  onServerRendered({
    errors,
    request,
    stats,
  }: {
    errors: Error[];
    request: Request;
    stats: RenderStats;
  }): void {}
  onConfigLoadError(err: Error) {}

  onConfigValidationError(filePath: string, failure: Failure) {}

  onExitSignalReceived(signal: NodeJS.Signals) {}

  onServerListening(address: string) {}

  onServerRenderError(err: Error) {}

  onValidConfiguration(config: NostalgieConfig) {}
}

export class TerminalLogger implements Logger {
  onServerRendered({
    errors,
    request,
    stats,
  }: {
    errors: Error[];
    request: Request;
    stats: RenderStats;
  }): void {
    console.error(
      `${Chalk.dim.green('++')} ${Chalk.bold(
        request.method.toUpperCase()
      )} ${Chalk.bold(request.path)} in ${stats.latency}ms (renders: ${
        stats.renderCount
      })`
    );

    for (const err of errors) {
      console.error(`${Chalk.dim.red('!!')} ${err.message}`);
    }
  }
  onConfigLoadError(err: Error) {
    console.error(
      `${Chalk.bold.redBright('!!')} Error loading the ${Chalk.bold(
        'nostalgie.conf.(js|ts)'
      )} file:`
    );
    console.error(
      Chalk.red(
        getErrorLinesWithCause(err, {
          indent: '   ',
          indentDepth: 1,
          indentString: '  ',
        }).join('\n')
      )
    );
    console.error(
      `${Chalk.dim.redBright('!!')} ${Chalk.dim(
        'Waiting for the issues to be corrected...'
      )}`
    );
  }

  onConfigValidationError(filePath: string, failure: Failure) {
    console.error(
      `${Chalk.bold.redBright(
        '!!'
      )} Failed to validate the config file ${Chalk.bold(
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
      `${Chalk.bold.yellowBright('##')} Received signal ${Chalk.bold(
        signal
      )}, exiting...`
    );
  }

  onServerListening(address: string) {
    console.error(
      `${Chalk.bold.greenBright('++')} Server started at ${Chalk.bold(address)}`
    );
  }

  onServerRenderError(err: Error) {
    console.error(err);
  }

  onValidConfiguration(config: NostalgieConfig) {
    console.error(`${Chalk.bold.greenBright('++')} Configuration reloaded.`);
  }
}

export function createDefaultLogger(): Logger {
  return new TerminalLogger();
}
