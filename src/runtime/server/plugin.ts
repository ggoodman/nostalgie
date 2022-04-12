import type { AssetManifest } from './manifest';
import type { Request } from './request';
import type { Response } from './response';

export type RootComponent = (props: any) => React.ReactElement;

export interface ClientPluginReference {
  importSpec: string;
  options?: unknown;
}

interface RendererPluginHostOptions {
  assetManifest: AssetManifest;
  deadlineAt: number;
  request: Readonly<Request>;
  renderMode: 'client' | 'server';
  start: number;
}

interface ServerPluginContext<TPluginState = unknown>
  extends RendererPluginHostOptions {
  state: TPluginState;
}

export interface ServerPlugin<TPluginState = unknown> {
  name: string;

  /**
   * Create a per-build state object or value that will be available throughout the render
   * pipeline as the `ctx.state` property on all hooks.
   */
  createState?(ctx: Omit<ServerPluginContext, 'state'>): TPluginState;

  /**
   * Wrap or replace the root React component. Useful for injecting Providers.
   *
   * Example:
   * ```js
   * function wrapProviderPlugin(provider, providerProps = null) {
   *   return {
   *     name: 'wrap-provider-plugin',
   *     decorateApp(ctx, app) {
   *       return () => React.createElement(provider, providerProps, React.createElement(app));
   *     }
   *   }
   * }
   * ```
   */
  decorateApp?(
    ctx: ServerPluginContext<TPluginState>,
    app: RootComponent
  ): RootComponent;

  /**
   * Called at each tick of the server render loop to see if circumstances are such that no further
   * rendering should happen. For example, a routing plugin that receives a redirect instruction
   * would return `true` to prevent any further renders from happening.
   */
  shouldAbortRendering?(ctx: ServerPluginContext<TPluginState>): boolean;

  /**
   * Called at each tick of the server render loop to see if the plugin has any pending operations
   * that should be awaited.
   *
   * Note that even if a plugin returns pending operations, it is possible that the request is
   * served without waiting for these to complete. This might happen if the render deadline
   * passes or if another plugin signals that rendering should abort via `shouldAbortRendering`.
   */
  getPendingOperations?(
    ctx: ServerPluginContext<TPluginState>
  ): PromiseLike<unknown>[];

  /**
   * Called after the server render loop is exited, giving plugins an opportunity to stop any
   * pending work.
   */
  cancelPendingOperations?(
    ctx: ServerPluginContext<TPluginState>
  ): PromiseLike<void>;

  /**
   * Called with an [linkedom](https://npm.im/linkedom) `Document` instance, giving plugins
   * the ability to manipulate the document prior to serializing and serving it.
   *
   * Plugins might use this to set the document's title, change element attributes or perform
   * any other DOM manipulation that should be reflected in the actual HTML served.
   */
  renderHtml?(ctx: ServerPluginContext<TPluginState>, document: Document): void;

  /**
   * Get bootstrap data that the server-side plugin wishes to pass to the client-side plugin.
   *
   * This gives server plugins the ability to pass data to their client-side counterparts. A
   * server-side plugin might, for example, accumulate some state in an object returned by the
   * `createState` hook.
   */
  getClientBootstrapData?(ctx: ServerPluginContext<TPluginState>): unknown;

  /**
   * Decorate or replace the pending Response.
   *
   * This gives server plugins the ability to modify or replace the Response object that is about
   * to be served back to the caller. This is useful for server plugins that might want to inject
   * custom http headers or even replace the response with a redirect.
   */
  decorateResponse?(
    ctx: ServerPluginContext<TPluginState>,
    response: Response
  ): Response | undefined | null;
}

export class RendererPluginHost {
  private readonly pluginsWithState: Array<{
    readonly plugin: Readonly<ServerPlugin>;
    readonly state: unknown;
  }> = [];
  private readonly ctx: Readonly<RendererPluginHostOptions>;

  constructor(
    plugins: ReadonlyArray<Readonly<ServerPlugin>>,
    options: RendererPluginHostOptions
  ) {
    this.ctx = options;

    for (const plugin of plugins) {
      // Initialize each plugin's state (if any)
      this.pluginsWithState.push({
        plugin: plugin,
        state: plugin.createState?.(this.ctx),
      });
    }
  }

  getBuildPlugins() {}

  decorateApp(app: RootComponent) {
    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.decorateApp === 'function') {
        // Apply a sort of reducer pattern to wrap / decorate
        // the app component with whatever the Plugin wants to
        // contribute.
        app = plugin.decorateApp(
          {
            ...this.ctx,
            state,
          },
          app
        );
      }
    }

    return app;
  }

  shouldAbortRendering(): boolean {
    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.shouldAbortRendering === 'function') {
        if (
          plugin.shouldAbortRendering({
            ...this.ctx,
            state,
          })
        ) {
          return true;
        }
      }
    }

    return false;
  }

  getPendingOperations(): PromiseLike<unknown>[] {
    const pendingOperations: PromiseLike<unknown>[] = [];

    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.getPendingOperations === 'function') {
        pendingOperations.push(
          ...plugin.getPendingOperations({
            ...this.ctx,
            state,
          })
        );
      }
    }

    return pendingOperations;
  }

  async cancelPendingOperations(): Promise<void> {
    const promises: PromiseLike<void>[] = [];

    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.cancelPendingOperations === 'function') {
        promises.push(
          plugin.cancelPendingOperations({
            ...this.ctx,
            state,
          })
        );
      }
    }

    if (promises.length) {
      await Promise.all(promises);
    }
  }

  renderHtml(document: HTMLDocument) {
    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.renderHtml === 'function') {
        plugin.renderHtml(
          {
            ...this.ctx,
            state,
          },
          document
        );
      }
    }
  }

  getClientBootstrapData(): Record<string, unknown> {
    const bootstrapData: Record<string, unknown> = {};

    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.getClientBootstrapData === 'function') {
        const clientBootstrapData = plugin.getClientBootstrapData({
          ...this.ctx,
          state,
        });

        if (clientBootstrapData) {
          bootstrapData[plugin.name] = clientBootstrapData;
        }
      }
    }

    return bootstrapData;
  }
}
