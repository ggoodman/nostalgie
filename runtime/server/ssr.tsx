import Boom from '@hapi/boom';
import typography from '@twind/typography';
import type { ServerFunctionContext } from 'nostalgie';
import {
  ChunkManager,
  LazyContext,
  QueryClient,
  QueryClientProvider,
  ServerFunction,
  StaticRouter,
} from 'nostalgie/internals';
import * as React from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { HeadProvider } from 'react-head';
import { MutationCache, QueryCache } from 'react-query';
import { dehydrate, DehydratedState, Hydrate } from 'react-query/hydration';
import ssrPrepass from 'react-ssr-prepass';
import { create, silent } from 'twind';
import { getStyleTag, shim, virtualSheet } from 'twind/server';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import * as Functions from '__nostalgie_functions__';
import { MethodKind } from './constants';

declare const App: React.ComponentType;
declare const Functions: { [functionName: string]: ServerFunction | undefined };

const queryCache = new QueryCache();
const mutationCache = new MutationCache({});
const DEFAULT_SERVER_STALE_TIME = Infinity;

export interface RenderTreeResult {
  preloadScripts: [chunk: string, lazyImport: string][];
  headTags: string[];
  markup: string;
  reactQueryState: DehydratedState;
}

export function dispatch(request: {
  op: MethodKind.INVOKE_FUNCTION;
  args: { functionName: string; ctx: ServerFunctionContext; args: any[] };
}): Promise<unknown>;
export function dispatch(request: {
  op: MethodKind.RENDER_TREE;
  args: { path: string };
}): Promise<RenderTreeResult>;
export default function dispatch(request: { op: MethodKind; args: any }) {
  switch (request.op) {
    case MethodKind.INVOKE_FUNCTION:
      return invokeFunction(request.args.functionName, request.args.ctx, request.args.args);
    case MethodKind.RENDER_TREE:
      return renderAppOnServer(request.args.path);
  }
}

function invokeFunction(functionName: string, ctx: ServerFunctionContext, args: any[]) {
  const functionImpl = Functions[functionName] as ServerFunction | undefined;

  if (!functionImpl) {
    throw Boom.notFound();
  }

  return functionImpl(ctx, ...args);
}

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_SERVER_STALE_TIME,
      suspense: true,
    },
  },
});

async function renderAppOnServer(path: string): Promise<RenderTreeResult> {
  const chunkCtx: ChunkManager = {
    chunks: new Map(),
    lazyComponentState: new Map(),
  };

  const customSheet = virtualSheet();

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

  // We need to reset the sheet _right before_ rendering even if single-use 🤷‍♂️
  customSheet.reset();
  const markup = renderToString(model);

  const shimmedMarkup = shim(markup, tw);
  const queryClientData = dehydrate(queryClient);

  return {
    preloadScripts: [...chunkCtx.chunks],
    headTags: [...headTags.map(renderToStaticMarkup), getStyleTag(customSheet)],
    markup: shimmedMarkup,
    reactQueryState: queryClientData,
  };
}
