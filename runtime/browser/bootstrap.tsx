///<reference lib="dom" />
import typography from '@twind/typography';
import { BrowserRouter, ChunkManager, LazyContext, register } from 'nostalgie/internals';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { HeadProvider } from 'react-head';
import { QueryClient, QueryClientProvider } from 'react-query';
import { DehydratedState, Hydrate } from 'react-query/hydration';
import { setup, silent } from 'twind';
import 'twind/shim';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';

declare const App: React.ComponentType;

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export interface BootstrapOptions {
  lazyComponents: LazyComponent[];
  reactQueryState: DehydratedState;
}

const DEFAULT_BROWSER_STALE_TIME = 16;

export async function start(options: BootstrapOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Set an initial really long stale timeout so that SSR hydration
        // doesn't complain about mismatches.
        staleTime: DEFAULT_BROWSER_STALE_TIME,
      },
    },
  });

  const chunkCtx: ChunkManager = {
    chunks: new Map(),
    lazyComponentState: new Map(),
  };

  setup({
    mode: silent,
    plugins: {
      ...typography(),
    },
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
        <QueryClientProvider client={queryClient}>
          <Hydrate state={options.reactQueryState}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </Hydrate>
        </QueryClientProvider>
      </HeadProvider>
    </LazyContext.Provider>,
    document.getElementById('root')
  );
}
