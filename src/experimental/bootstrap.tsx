import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Markup from 'react-helmet-async';
import { DEFAULT_MARKUP_PROPS } from './constants';

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export interface BootstrapOptions {
  // auth: ClientAuth;
  automaticReload?: boolean;
  enableTailwind?: boolean;
  // errStack?: Entry[];
  lazyComponents: LazyComponent[];
  publicUrl: string;
}

export async function hydrateNostalgie(App: React.ComponentType, options: BootstrapOptions) {
  const rootEl = document.getElementById('root');

  const promises = options.lazyComponents.map(({ chunk, lazyImport }) => {
    return import(`${options.publicUrl}${chunk}`).then((m) => {
      // register(chunkCtx, chunk, lazyImport, m);
    });
  });

  await Promise.all(promises);

  ReactDOM.hydrate(
    <Markup.HelmetProvider>
      <Markup.Helmet {...DEFAULT_MARKUP_PROPS}></Markup.Helmet>
      <App />
    </Markup.HelmetProvider>,
    rootEl
  );
}
