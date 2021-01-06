import Yargs from 'yargs';
import { CommandHost } from './command';
import * as Commands from './commands';

export function executeCommandLine() {
  Yargs.help();
  Yargs.demandCommand();
  Yargs.recommendCommands();
  Yargs.strict();
  Yargs.showHelpOnFail(false);

  const commandHost = new CommandHost(Yargs);
  const keys = Object.keys(Commands) as [keyof typeof Commands];

  for (const moduleName of keys) {
    const commandModule = Commands[moduleName];

    commandModule.setup(commandHost);
  }

  Yargs.argv;
}
