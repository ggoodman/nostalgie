import type * as React from 'react';
import type { Request } from './lifecycle';

export type RootComponent = (props: any) => React.ReactElement;

interface RendererPluginHostOptions {
  deadlineAt: number;
  request: Readonly<Request>;
  renderMode: 'client' | 'server';
  start: number;
}

interface PluginContext<TPluginState = unknown> extends RendererPluginHostOptions {
  state: TPluginState;
}

export interface Plugin<TPluginState = unknown> {
  name: string;
  createState?(ctx: Omit<PluginContext, 'state'>): TPluginState;
  decorateApp?(ctx: PluginContext<TPluginState>, app: RootComponent): RootComponent;
  shouldContinueRendering?(ctx: PluginContext<TPluginState>): boolean;
  shouldAbortRendering?(ctx: PluginContext<TPluginState>): boolean;
  getPendingOperations?(ctx: PluginContext<TPluginState>): PromiseLike<unknown>[];
  cancelPendingOperations?(ctx: PluginContext<TPluginState>): PromiseLike<void>;
  renderHtml?(ctx: PluginContext<TPluginState>, document: Document): void;
  getBootstrapData?(ctx: PluginContext<TPluginState>): unknown;
}

export class RendererPluginHost {
  private readonly pluginsWithState: Array<{ plugin: Readonly<Plugin>; state: unknown }> = [];
  private readonly ctx: Readonly<RendererPluginHostOptions>;

  constructor(plugins: ReadonlyArray<Readonly<Plugin>>, options: RendererPluginHostOptions) {
    this.ctx = options;

    for (const plugin of plugins) {
      // Initialize each plugin's state (if any)
      this.pluginsWithState.push({
        plugin: plugin,
        state: plugin.createState?.(this.ctx),
      });
    }
  }

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

  shouldContinueRendering(): boolean {
    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.shouldContinueRendering === 'function') {
        if (
          plugin.shouldContinueRendering({
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

  getBootstrapData(): Record<string, unknown> {
    const bootstrapData: Record<string, unknown> = {};

    for (const { plugin, state } of this.pluginsWithState) {
      if (typeof plugin.getBootstrapData === 'function') {
        bootstrapData[plugin.name] = plugin.getBootstrapData({
          ...this.ctx,
          state,
        });
      }
    }

    return bootstrapData;
  }
}
