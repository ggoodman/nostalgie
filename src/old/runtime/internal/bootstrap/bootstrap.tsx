///<reference lib="dom" />
import TwindTypography from '@twind/typography';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Markup from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import * as ReactRouterDOM from 'react-router-dom';
import type { ClientAuth } from '../../auth';
import { AuthContext } from '../../auth/server';
import { LazyContext } from '../../lazy/context';
import { register } from '../../lazy/register';
import type { ChunkManager } from '../../lazy/types';
import { defaultMarkupProps } from '../../markup';

interface LazyComponent {
  chunk: string;
  lazyImport: string;
}

declare interface SourceFile {
  path: string;
  text: string;
  lines: string[];
  error?: Error;
}

declare interface Location {
  file: string;
  line?: number;
  column?: number;
}

declare interface Entry extends Location {
  beforeParse: string;
  callee: string;
  index: boolean;
  native: boolean;

  calleeShort: string;
  fileRelative: string;
  fileShort: string;
  fileName: string;
  thirdParty: boolean;

  hide?: boolean;
  sourceLine?: string;
  sourceFile?: SourceFile;
  error?: Error;
}

export interface BootstrapOptions {
  auth: ClientAuth;
  automaticReload?: boolean;
  enableTailwind?: boolean;
  errStack?: Entry[];
  lazyComponents: LazyComponent[];
  publicUrl: string;
  reactQueryState: ReactQueryHydration.DehydratedState;
}

const DEFAULT_BROWSER_STALE_TIME = 16;

export async function hydrateNostalgie(App: React.ComponentType, options: BootstrapOptions) {
  if (process.env.NODE_ENV === 'development') {
    // Nest this 2nd condition to make it extra easy for DCE in production.
    if (options.automaticReload) {
      const eventSource = new EventSource('/.nostalgie/events');

      eventSource.addEventListener('reload', (e) => {
        window.location.reload();
      });
    }

    const errStack = options.errStack;

    if (errStack) {
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'absolute';
      errorDiv.style.right = '0';
      errorDiv.style.bottom = '0';
      errorDiv.style.fontFamily = 'monospace';
      errorDiv.style.backgroundColor = 'red';
      errorDiv.style.color = '#f5f5f5';
      errorDiv.style.whiteSpace = 'pre';
      errorDiv.style.zIndex = '9999';
      errorDiv.style.padding = '1em 1.5em';

      errorDiv.innerHTML = errStack
        .map((entry) => {
          const vscodeUri = encodeURI(`vscode://file/${entry.file}:${entry.line}:${entry.column}`);

          return `<div><a href=${JSON.stringify(vscodeUri)}>${entry.callee}</a></div>`;
        })
        .join('\n');

      document.body.prepend(errorDiv);
    }
  }

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
  const rootEl = document.getElementById('root');

  if (options.enableTailwind) {
    const { setup } = await import('twind/shim');

    setup({
      mode: 'silent',
      prefix: true,
      preflight: true,
      plugins: {
        ...TwindTypography(),
      },
      target: rootEl!,
    });
  }

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
          <Markup.HelmetProvider>
            <AuthContext.Provider value={options.auth}>
              <ReactRouterDOM.BrowserRouter>
                <Markup.Helmet {...defaultMarkupProps}></Markup.Helmet>
                <App />
              </ReactRouterDOM.BrowserRouter>
            </AuthContext.Provider>
          </Markup.HelmetProvider>
        </ReactQueryHydration.Hydrate>
      </ReactQuery.QueryClientProvider>
    </LazyContext.Provider>,
    rootEl
  );
}
