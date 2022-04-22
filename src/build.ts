import type { Context } from '@ggoodman/context';
import reactRefreshPlugin from '@vitejs/plugin-react';
import * as Path from 'node:path';
import { build, type InlineConfig } from 'vite';
import { createDedupePlugin } from './build/plugins/dedupe';
import { createMdxPlugin } from './build/plugins/mdx';
import type { NostalgieConfig } from './config';
import { NOSTALGIE_MANIFEST_MODULE_ID } from './constants';
import { invariant } from './invariant';
import type { Logger } from './logging';
import { nostalgieClientEntryPlugin } from './plugins/nostalgieClientEntry';
import { nostalgieConfigPlugin } from './plugins/nostalgieConfig';
import { nostalgiePluginsPlugin } from './plugins/nostalgiePlugins';
import { nostalgieServerEntryPlugin } from './plugins/nostalgieServerEntry';

// const debug = Debug.debug('nostalgie:dev');

export async function buildProject(
  ctx: Context,
  logger: Logger,
  config: NostalgieConfig
) {
  logger.onValidConfiguration(config);

  const clientEntrypointUrl = `nostalgie.client.js`;
  const serverEntrypointUrl = `nostalgie.server.js`;
  const serverRenderPluginImports: string[] = [];
  const serverRenderPluginInstantiations: string[] = [];
  const clientRenderPluginImports: string[] = [];
  const clientRenderPluginInstantiations: string[] = [];

  // TODO: This should be configurable
  // const urlPrefix = '/static';

  // const appEntryUrl = `${urlPrefix}/static/app.es.js`;

  const viteConfig: InlineConfig = {
    root: config.rootDir,
    configFile: false,
    mode: 'production',
    clearScreen: false,
    logLevel: 'info',
    plugins: [
      nostalgieConfigPlugin(config),
      nostalgiePluginsPlugin({
        serverRenderPluginImports,
        serverRenderPluginInstantiations,
        clientRenderPluginImports,
        clientRenderPluginInstantiations,
      }),
      nostalgieServerEntryPlugin({
        config,
        clientEntrypointUrl,
        serverEntrypointUrl,
        serverRenderPluginImports,
        serverRenderPluginInstantiations,
      }),
      nostalgieClientEntryPlugin({
        config,
        clientEntrypointUrl,
        clientRenderPluginImports,
        clientRenderPluginInstantiations,
      }),
      createDedupePlugin(),
      {
        name: 'nostalgie',
        resolveId(source) {
          if (source === NOSTALGIE_MANIFEST_MODULE_ID) {
            return {
              id: Path.resolve(config.rootDir, './out/manifest.json'),
            };
          }
        },
      },
      reactRefreshPlugin(),
      createMdxPlugin(),
      ...(config.settings.plugins || []),
    ],
  };

  const appEntrypoint = config.settings.appEntrypoint;

  invariant(appEntrypoint, 'App entrypoint is missing or falsy');

  await build({
    ...viteConfig,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      target: 'modules',
      rollupOptions: {
        input: [clientEntrypointUrl],
        output: {
          exports: 'named',
        },
        preserveEntrySignatures: 'strict',
      },
      outDir: './out',
      polyfillModulePreload: false,

      emptyOutDir: true,
      cssCodeSplit: true,
      minify: false,
      manifest: true,
      ssr: false,
    },
    optimizeDeps: {
      entries: [clientEntrypointUrl, appEntrypoint],
    },
  });

  await build({
    ...viteConfig,
    build: {
      target: 'node16',

      rollupOptions: {
        input: [serverEntrypointUrl],
      },
      outDir: './out',

      polyfillModulePreload: false,
      emptyOutDir: false,
      cssCodeSplit: false,
      minify: false,
      manifest: false,
      assetsDir: '',

      ssr: true,
    },
    optimizeDeps: {
      entries: [serverEntrypointUrl, appEntrypoint],
    },
  });
}
