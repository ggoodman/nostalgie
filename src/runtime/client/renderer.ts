import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { invariant } from '../../invariant';
import { RendererPluginHost, type ClientPlugin } from './plugin';

export type RootComponent = (props: any) => React.ReactElement;

export interface ClientRendererOptions {
  appRoot: RootComponent;
  // lazyComponents: LazyComponent[];
  publicUrl: string;
  plugins?: ClientPlugin[];
}

export class ClientRenderer {
  private readonly appRoot: RootComponent;
  // private readonly lazyComponents: LazyComponent[];
  // private readonly publicUrl: string;
  private readonly plugins: ClientPlugin[];

  constructor(options: ClientRendererOptions) {
    this.appRoot = options.appRoot;
    // this.lazyComponents = options.lazyComponents;
    // this.publicUrl = options.publicUrl;
    this.plugins = options.plugins ?? [];
  }

  async render(pluginBootstrapData: Record<string, unknown> = {}) {
    try {
      const rootElement = document.getElementById('root');
      invariant(rootElement, 'Missing the #root element.');

      // This is the request-specific instance that will run all our plugins for us
      const pluginHost = new RendererPluginHost(this.plugins, {
        rootElement,
        serverData: pluginBootstrapData,
      });
      const appRoot = pluginHost.decorateApp(this.appRoot);
      const maybeBeforeRenderPromise = pluginHost.onBeforeRender(appRoot);

      if (maybeBeforeRenderPromise) {
        await maybeBeforeRenderPromise;
      }

      ReactDOM.hydrateRoot(rootElement, React.createElement(appRoot), {
        onRecoverableError(err) {
          console.debug(err);
        },
      });
    } catch (err) {
      throw err;
    }
  }
}
