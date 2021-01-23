import type { AbortSignal } from 'abort-controller';
import type { Service } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import type { Logger } from 'pino';
import { createRequire } from '../createRequire';
import type { NostalgieSettings } from '../settings';
import { buildClient } from './buildClient';
import { buildNodeServer } from './buildNodeServer';
import { buildServerFunctions } from './buildServerFunctions';
import { ClientBuildMetadata } from './metadata';

export async function build(options: {
  logger: Logger;
  settings: NostalgieSettings;
  service: Service;
  signal: AbortSignal;
}) {
  const { logger, settings, service } = options;

  const rebuild = async () => {
    const functionBuildPromise = (async () => {
      const functionMeta = await buildServerFunctions(service, settings);

      if (settings.functionsEntryPoint) {
        logger.info(
          { pathName: settings.builtFunctionsPath, functionNames: functionMeta.functionNames },
          'server functions build'
        );
      } else {
        logger.info('no server function entrypoint detected, skipping');
      }

      return functionMeta;
    })();
    const clientBuildMetadataPromise = (async () => {
      const { functionNames } = await functionBuildPromise;
      const clientBuildMetadata = await buildClient(
        service,
        settings,
        functionNames,
        options.signal
      );

      logger.info({ pathName: settings.staticDir }, 'client assets written');

      return new ClientBuildMetadata(settings, clientBuildMetadata);
    })();

    const nodeServerPromise = (async () => {
      const clientBuildMetadata = await clientBuildMetadataPromise;
      // const { serverFunctionsSourcePath } = await functionNamesPromise;

      await buildNodeServer(service, settings, logger, clientBuildMetadata, options.signal);

      logger.info({ pathName: settings.builtServerPath }, 'node server written');
    })();

    const packageJsonPromise = (async () => {
      await Fs.mkdir(settings.buildDir, { recursive: true });
      await Fs.writeFile(
        Path.join(settings.buildDir, 'package.json'),
        JSON.stringify(
          {
            name: 'nostalgie-app',
            version: '0.0.0',
            private: true,
            main: './index.js',
            // type: 'module',
            engines: {
              node: '> 12.2.0',
            },
            engineStrict: true,
            scripts: {
              start: 'node ./index.js',
            },
          },
          null,
          2
        )
      );
    })();

    await Promise.all([
      clientBuildMetadataPromise,
      functionBuildPromise,
      nodeServerPromise,
      packageJsonPromise,
    ]);
  };

  await rebuild();

  return {
    async loadHapiServer() {
      const buildRelativeRequire = createRequire(Path.join(settings.buildDir, 'index.js'));

      // TODO: Fix this type when we're back under control (typeof import('../runtime/server/node'))
      return buildRelativeRequire('./index.js') as typeof import('../runtime/runtimes/node');
    },
    rebuild,
  };
}
