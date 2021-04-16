import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { invariant } from '../../invariant';
import type { ClientPlugin } from './plugin';

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
  private readonly publicUrl: string;
  private readonly plugins: ClientPlugin[];

  constructor(options: ClientRendererOptions) {
    this.appRoot = options.appRoot;
    // this.lazyComponents = options.lazyComponents;
    this.publicUrl = options.publicUrl;
    this.plugins = options.plugins ?? [];
  }

  async render() {
    const rootEl = document.getElementById('root');

    invariant(rootEl, 'Missing the #root element.');

    for (const plugin of this.plugins) {
      if (typeof plugin.onBeforeRender === 'function') {
        plugin.onBeforeRender({
          rootElement: rootEl,
        });
      }
    }

    // const promises = this.lazyComponents.map(({ chunk, lazyImport }) => {
    //   return import(`${this.publicUrl}${chunk}`).then((m) => {
    //     // register(chunkCtx, chunk, lazyImport, m);
    //   });
    // });

    // await Promise.all(promises);

    ReactDOM.hydrate(React.createElement(this.appRoot), rootEl);
  }
}
