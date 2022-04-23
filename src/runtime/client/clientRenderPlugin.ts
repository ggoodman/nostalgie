import type * as React from 'react';

type RootComponent = (props: any) => React.ReactElement;

export interface RendererPluginHostOptions {
  rootElement: HTMLElement;
  serverData: Record<string, unknown>;
}

export interface ClientPluginContext<TServerData = unknown, TState = unknown> {
  rootElement: HTMLElement;
  serverData: TServerData;
  state: TState;
}

export interface ClientPlugin<TServerData = unknown, TPluginState = unknown> {
  name: string;
  /**
   * Create a per-build state object or value that will be available throughout the render
   * pipeline as the `ctx.state` property on all hooks.
   */
  createState?(
    ctx: Omit<ClientPluginContext<TServerData>, 'state'>
  ): TPluginState;

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
    ctx: ClientPluginContext<TServerData, TPluginState>,
    app: RootComponent
  ): RootComponent;

  onBeforeRender?(
    ctx: ClientPluginContext<TServerData, TPluginState>
  ): Promise<unknown> | void;
}

export class RendererPluginHost {
  private readonly pluginsWithStateAndServerData: Array<{
    readonly plugin: Readonly<ClientPlugin>;
    readonly serverData: unknown;
    readonly state: unknown;
  }> = [];
  private readonly rootElement: HTMLElement;

  constructor(
    plugins: ReadonlyArray<Readonly<ClientPlugin>>,
    options: RendererPluginHostOptions
  ) {
    this.rootElement = options.rootElement;

    for (const plugin of plugins) {
      const serverData = options.serverData[plugin.name];

      // Initialize each plugin's state (if any)
      this.pluginsWithStateAndServerData.push({
        plugin: plugin,
        serverData,
        state: plugin.createState?.({
          rootElement: options.rootElement,
          serverData,
        }),
      });
    }
  }

  decorateApp(app: RootComponent) {
    for (const { plugin, serverData, state } of this
      .pluginsWithStateAndServerData) {
      if (typeof plugin.decorateApp === 'function') {
        // Apply a sort of reducer pattern to wrap / decorate
        // the app component with whatever the Plugin wants to
        // contribute.
        app = plugin.decorateApp(
          {
            rootElement: this.rootElement,
            serverData,
            state,
          },
          app
        );
      }
    }

    return app;
  }

  onBeforeRender(app: RootComponent): Promise<unknown> | undefined {
    const promises: Promise<unknown>[] = [];

    for (const { plugin, serverData, state } of this
      .pluginsWithStateAndServerData) {
      const maybePromise = plugin.onBeforeRender?.({
        rootElement: this.rootElement,
        serverData,
        state,
      });

      if (maybePromise) {
        promises.push(maybePromise);
      }
    }

    return promises.length ? Promise.all(promises) : undefined;
  }
}
