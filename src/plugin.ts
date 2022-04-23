import type { Plugin as VitePlugin, UserConfig } from 'vite';
import type { NostalgieConfig } from './config';

type MaybeArray<T> = Array<T> | T;

export interface RendererPluginReference {
  readonly spec: string;
  readonly exportName?: string;
  readonly config: unknown;
}

/**
 * A Nostalgie Plugin is a specialized Vite plugin that introduces two additional hooks:
 *
 *   1. `getServerRendererPlugins`; and
 *   2. `getClientRendererPlugins`.
 *
 * As a result, a Nostalgie plugin can do anything that a Vite plugin can as well as
 * signalling which renderer plugins should be injected at build-time. A Nostalgie
 * plugin can't pass a reference to these server and client renderer plugins as doing
 * so would force the Nostalgie Plugin itself to end up in the resulting build.
 *
 * We don't want the Nostalgie Plugin or its dependencies to end up in the production
 * build but we DO want the client and server renderer plugins to be included. To
 * accomplish this, we need to return a weak reference to these. We use import specifiers
 * for now.
 */
export interface Plugin extends VitePlugin {
  getServerRendererPlugins?: () =>
    | MaybeArray<RendererPluginReference>
    | undefined;
  getClientRendererPlugins?: () =>
    | MaybeArray<RendererPluginReference>
    | undefined;

  preconfigure?: (
    nostalgieConfig: NostalgieConfig,
    viteConfig: UserConfig
  ) => void | Promise<void>;
}
