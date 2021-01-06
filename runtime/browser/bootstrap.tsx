///<reference lib="dom" />
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import 'twind/shim';
import { setup, silent } from 'twind';
import { ChunkManager, LazyContext, register } from 'nostalgie/internals';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';
import { HeadProvider } from 'react-head';

declare const App: React.ComponentType;

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export interface BootstrapOptions {
  lazyComponents: LazyComponent[];
}

export async function start(options: BootstrapOptions) {
  const chunkCtx: ChunkManager = {
    chunks: new Map(),
    lazyComponentState: new Map(),
  };

  setup({
    mode: silent,
  });

  const promises = options.lazyComponents.map(({ chunk, lazyImport }) => {
    return import(`/${chunk}`).then((m) => {
      register(chunkCtx, chunk, lazyImport, m);
    });
  });

  await Promise.all(promises);

  ReactDOM.hydrate(
    <LazyContext.Provider value={chunkCtx}>
      <HeadProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HeadProvider>
    </LazyContext.Provider>,
    document.getElementById('root')
  );
}
