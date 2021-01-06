import type { Argv, InferredOptionTypes, Options } from 'yargs';

type NamedCommand<TBuilder extends { [key: string]: Options }> = {
  name: string;
  description: string;
  options: TBuilder;
};

type Handler<TBuilder extends { [key: string]: Options }> = (
  args: InferredOptionTypes<TBuilder>
) => void;

export class CommandHost {
  constructor(private readonly yargs: Argv<any>) {}

  registerNamedCommand<TCommand extends NamedCommand<any>>(
    command: TCommand,
    handler: Handler<TCommand['options']>
  ) {
    this.yargs.command(command.name, command.description, command.options, handler);
  }
}
