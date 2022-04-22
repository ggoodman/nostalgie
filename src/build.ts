import type { Context } from '@ggoodman/context';
import reactRefreshPlugin from '@vitejs/plugin-react';
import type { RollupOutput } from 'rollup';
import { build, LogLevel, type InlineConfig } from 'vite';
import { createDedupePlugin } from './build/plugins/dedupe';
import { createMdxPlugin } from './build/plugins/mdx';
import type { NostalgieConfig } from './config';
import { invariant } from './invariant';
import type { Logger } from './logging';
import { nostalgieClientEntryPlugin } from './plugins/nostalgieClientEntry';
import { nostalgieConfigPlugin } from './plugins/nostalgieConfig';
import { createManifestPlugin } from './plugins/nostalgieManifest';
import { nostalgiePluginsPlugin } from './plugins/nostalgiePlugins';
import { nostalgieServerEntryPlugin } from './plugins/nostalgieServerEntry';

// const debug = Debug.debug('nostalgie:dev');

export interface BuildProjectOptions {
  logLevel?: LogLevel;
  noEmit?: boolean;
}

export async function buildProject(
  ctx: Context,
  logger: Logger,
  config: NostalgieConfig,
  options?: BuildProjectOptions
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

  const viteConfig: InlineConfig = {
    root: config.rootDir,
    configFile: false,
    mode: 'production',
    clearScreen: false,
    logLevel: options?.logLevel ?? 'info',
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
      reactRefreshPlugin(),
      createMdxPlugin(),
      ...(config.settings.plugins || []),
    ],
  };

  const appEntrypoint = config.settings.appEntrypoint;

  invariant(appEntrypoint, 'App entrypoint is missing or falsy');

  const clientBuild = (await Promise.race([
    ctx,
    build({
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
        minify: true,
        manifest: true,
        ssr: false,

        write: !options?.noEmit,
      },
      optimizeDeps: {
        entries: [clientEntrypointUrl, appEntrypoint],
      },
      plugins: [
        ...(viteConfig.plugins || []),
        // Dummy manifest
        createManifestPlugin(),
      ],
    }),
  ])) as RollupOutput;

  clientBuild.output;

  const serverBuild = (await Promise.race([
    ctx,
    build({
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

        write: !options?.noEmit,
      },
      optimizeDeps: {
        entries: [serverEntrypointUrl, appEntrypoint],
      },
      plugins: [
        ...(viteConfig.plugins || []),
        // Inject the manifest from the client build
        createManifestPlugin(clientBuild),
      ],
    }),
  ])) as RollupOutput;

  return {
    clientBuild,
    serverBuild,
  };
}
