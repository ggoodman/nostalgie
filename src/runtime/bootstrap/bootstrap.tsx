///<reference lib="dom" />
import TwindTypography from '@twind/typography';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Helmet from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import * as ReactRouterDOM from 'react-router-dom';
import * as Twind from 'twind';
import 'twind/shim';
import { defaultHelmetProps } from '../helmet';
import { LazyContext } from '../lazy/context';
import { register } from '../lazy/register';
import type { ChunkManager } from '../lazy/types';

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

export interface BootstrapOptions {
  lazyComponents: LazyComponent[];
  publicUrl: string;
  reactQueryState: ReactQueryHydration.DehydratedState;
}

const DEFAULT_BROWSER_STALE_TIME = 16;

export async function hydrateNostalgie(App: React.ComponentType, options: BootstrapOptions) {
  const queryClient = new ReactQuery.QueryClient({
    defaultOptions: {
      queries: {
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
    return import(`${options.publicUrl}${chunk}`).then((m) => {
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
              <Helmet.Helmet {...defaultHelmetProps}></Helmet.Helmet>
              <App />
            </ReactRouterDOM.BrowserRouter>
          </Helmet.HelmetProvider>
        </ReactQueryHydration.Hydrate>
      </ReactQuery.QueryClientProvider>
    </LazyContext.Provider>,
    document.getElementById('root')
  );
}
