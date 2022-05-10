import type { Context } from '@ggoodman/context';
import reactRefreshPlugin from '@vitejs/plugin-react';
import Debug from 'debug';
import type { RollupOutput } from 'rollup';
import { build, LogLevel, type InlineConfig } from 'vite';
import type { NostalgieConfig } from './config';
import { createManifestPlugin } from './internal/plugins/buildManifestPlugin';
import { nostalgieClientEntryPlugin } from './internal/plugins/clientEntryPlugin';
import { createDedupePlugin } from './internal/plugins/dedupe';
import { createMdxPlugin } from './internal/plugins/mdx';
import { nostalgiePluginsPlugin } from './internal/plugins/serializeRuntimePluginsPlugin';
import { nostalgieServerEntryPlugin } from './internal/plugins/serverEntryPlugin';
import { invariant } from './invariant';
import type { Logger } from './logging';
import type { Plugin } from './plugin';

const debug = Debug.debug('nostalgie:build');

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
      ...(config.plugins || []),
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
    ],
  };

  for (const plugin of viteConfig.plugins! as Plugin[]) {
    if (typeof plugin?.preconfigure === 'function') {
      await plugin?.preconfigure(config, viteConfig);
    }
  }

  const appEntrypoint = config.appEntrypoint;

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
        assetsDir: './assets',
        sourcemap: true,

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
