///<reference lib="dom" />
import TwindTypography from '@twind/typography';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Helmet from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import * as ReactRouterDOM from 'react-router-dom';
import Twind from 'twind';
import 'twind/shim';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';
import { LazyContext } from '../lazy/context';
import { register } from '../lazy/register';
import type { ChunkManager } from '../lazy/types';

declare const App: React.ComponentType;

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export interface BootstrapOptions {
  lazyComponents: LazyComponent[];
  reactQueryState: ReactQueryHydration.DehydratedState;
}

const DEFAULT_BROWSER_STALE_TIME = 16;

export async function start(options: BootstrapOptions) {
  const queryClient = new ReactQuery.QueryClient({
    defaultOptions: {
      queries: {
        // Set an initial really long stale timeout so that SSR hydration
        // doesn't complain about mismatches.
        staleTime: DEFAULT_BROWSER_STALE_TIME,
      },
    },
  });

  const chunkCtx: ChunkManager = {
    chunks: [],
    lazyComponentState: new Map(),
  };

  Twind.setup({
    mode: Twind.silent,
    plugins: {
      ...TwindTypography(),
    },
  });

  const promises = options.lazyComponents.map(({ chunk, lazyImport }) => {
    return import(chunk).then((m) => {
      register(chunkCtx, chunk, lazyImport, m);
    });
  });

  await Promise.all(promises);

  ReactDOM.hydrate(
    <LazyContext.Provider value={chunkCtx}>
      <ReactQuery.QueryClientProvider client={queryClient}>
        <ReactQueryHydration.Hydrate state={options.reactQueryState}>
          <Helmet.HelmetProvider>
            <ReactRouterDOM.BrowserRouter>
              <App />
            </ReactRouterDOM.BrowserRouter>
          </Helmet.HelmetProvider>
        </ReactQueryHydration.Hydrate>
      </ReactQuery.QueryClientProvider>
    </LazyContext.Provider>,
    document.getElementById('root')
  );
}
