import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Markup from 'react-helmet-async';
import { DEFAULT_MARKUP_PROPS } from './constants';

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export type RootComponent = (props: any) => React.ReactElement;

export interface ClientRendererOptions {
  appRoot: RootComponent;
  automaticReload?: boolean;
  enableTailwind?: boolean;
  lazyComponents: LazyComponent[];
  publicUrl: string;
}

export class ClientRenderer {
  private readonly appRoot: RootComponent;
  private readonly lazyComponents: LazyComponent[];
  private readonly publicUrl: string;

  constructor(options: ClientRendererOptions) {
    this.appRoot = options.appRoot;
    this.lazyComponents = options.lazyComponents;
    this.publicUrl = options.publicUrl;
  }

  async render() {
    const rootEl = document.getElementById('root');

    const promises = this.lazyComponents.map(({ chunk, lazyImport }) => {
      return import(`${this.publicUrl}${chunk}`).then((m) => {
        // register(chunkCtx, chunk, lazyImport, m);
      });
    });

    await Promise.all(promises);

    ReactDOM.hydrate(
      <Markup.HelmetProvider>
        <Markup.Helmet {...DEFAULT_MARKUP_PROPS}></Markup.Helmet>
        <this.appRoot />
      </Markup.HelmetProvider>,
      rootEl
    );
  }
}
