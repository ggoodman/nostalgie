import typography from '@twind/typography';
import {
  ChunkManager,
  LazyContext,
  QueryClient,
  QueryClientProvider,
  StaticRouter,
} from 'nostalgie/internals';
import * as React from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { HeadProvider } from 'react-head';
import { MutationCache, QueryCache } from 'react-query';
import { dehydrate, Hydrate } from 'react-query/hydration';
import ssrPrepass from 'react-ssr-prepass';
// @ts-ignore
// import { renderToStringAsync as renderToStringAsyncLightyear } from 'react-lightyear/server.node';
// import * as Stream from 'stream';
import { create, Sheet, silent } from 'twind';
import { shim } from 'twind/server';
// import * as Util from 'util';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';

declare const App: React.ComponentType;

// const finishedAsync = Util.promisify(Stream.finished);

const queryCache = new QueryCache({});
const mutationCache = new MutationCache({});
const DEFAULT_SERVER_STALE_TIME = 2000;

export default async function renderAppOnServer(path: string) {
  const chunkCtx: ChunkManager = {
    chunks: new Map(),
    lazyComponentState: new Map(),
  };
  const queryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_SERVER_STALE_TIME,
      },
    },
  });
  const target: string[] = [];
  const customSheet: Sheet<string[]> = {
    target,
    insert(rule, index) {
      // rule: the CSS rule to insert
      // index: the rule's position
      target.splice(index, 0, rule);
    },
  };

  const { tw } = create({
    sheet: customSheet,
    mode: silent,
    prefix: true,
    plugins: {
      ...typography(),
    },
  });
  const initialReactQueryState = dehydrate(queryClient);
  const headTags: React.ReactElement<unknown>[] = [];
  const model = (
    <StaticRouter location={path}>
      <LazyContext.Provider value={chunkCtx}>
        <QueryClientProvider client={queryClient}>
          <Hydrate state={initialReactQueryState}>
            <HeadProvider headTags={headTags}>
              <App />
            </HeadProvider>
          </Hydrate>
        </QueryClientProvider>
      </LazyContext.Provider>
    </StaticRouter>
  );

  await ssrPrepass(model);

  const markup = renderToString(model);
  const shimmedMarkup = shim(markup, tw);
  const initialRules = target.join('\n');
  const queryClientData = dehydrate(queryClient);

  return {
    preloadScripts: [...chunkCtx.chunks],
    headTags: [
      ...headTags.map(renderToStaticMarkup),
      `<style id="__twind">${initialRules}</style>`,
    ],
    markup: shimmedMarkup,
    reactQueryState: queryClientData,
  };
}
