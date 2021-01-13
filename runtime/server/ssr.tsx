import Boom from '@hapi/boom';
import typography from '@twind/typography';
import type {} from 'nostalgie';
import {
  ChunkManager,
  LazyContext,
  QueryClient,
  ServerFunction,
  ServerFunctionContext,
  ServerQueryContextProvider,
  ServerQueryExecutorImpl,
  StaticRouter,
} from 'nostalgie/internals';
import * as React from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { HeadProvider } from 'react-head';
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

declare const __nostalgie_chunks__: any;

const MAX_ASYNC_PREPASS_ITERATIONS = 20;

export interface RenderTreeResult {
  preloadScripts: { chunk: string; lazyImport: string }[];
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

async function renderAppOnServer(path: string, deadline: number = 500): Promise<RenderTreeResult> {
  const chunkDependencies = __nostalgie_chunks__;
  const chunkCtx: ChunkManager = {
    chunks: [],
    lazyComponentState: new Map(),
  };
  const queryClient = new QueryClient();

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
  const headTagElements: React.ReactElement<unknown>[] = [];
  const queryExecutor = new ServerQueryExecutorImpl(queryClient);
  const model = (
    <StaticRouter location={path}>
      <LazyContext.Provider value={chunkCtx}>
        <ServerQueryContextProvider queryExecutor={queryExecutor}>
          <Hydrate state={initialReactQueryState}>
            <HeadProvider headTags={headTagElements}>
              <App />
            </HeadProvider>
          </Hydrate>
        </ServerQueryContextProvider>
      </LazyContext.Provider>
    </StaticRouter>
  );

  // We're going to give a maximum amount of time for this render.
  const deadlineAt = Date.now() + deadline;
  // We've given ourselves a deadline so let's get a Promise that will resolve
  // when the deadline is reached to race against data-loading promises (if any).
  const deadlinePromise = new Promise((r) => setTimeout(r, deadline));

  // A first SSR async pass through the tree for critical stuff like dynamic imports
  await ssrPrepass(model);

  // We'll give ourselves a budget for the number of async passes we're willing to undertake
  let remainingIterations = MAX_ASYNC_PREPASS_ITERATIONS;

  let html: string | undefined = undefined;

  // Loop while we haven't exceeded our deadline or iteration budget and while we have pending queries
  for (
    ;
    // Condition
    Date.now() <= deadlineAt && queryExecutor.promises.size && remainingIterations;
    // Loop update (after loop block)
    remainingIterations--
  ) {
    try {
      // We're always going to race against our deadline promise so that we can interrupt potentially
      // earlier than the first query will settle.
      await Promise.race([deadlinePromise, ...queryExecutor.promises]);

      // Re-render the page, triggering any new queries unlocked by the new state.
      html = renderToString(model);
    } catch {
      // Break out and do the final rendering
      break;
    }
  }

  // Any outstanding queries should be cancelled at this point since our client's lifetime
  // is limited to this request anyway.
  const queryClientData = dehydrate(queryClient);
  const renderedMarkup = html ?? renderToString(model);

  queryClient.cancelQueries();

  // We need to reset the sheet _right before_ rendering even if single-use 🤷‍♂️
  customSheet.reset();

  const shimmedMarkup = shim(renderedMarkup, tw);
  const headTags = [];

  for (const { chunk } of chunkCtx.chunks) {
    const chunkDeps = chunkDependencies[chunk];

    if (chunkDeps) {
      for (const chunkDep of chunkDeps) {
        headTags.push(`<link rel="modulepreload" href="${chunkDep}">`);
      }
    }
  }

  return {
    preloadScripts: [...chunkCtx.chunks],
    headTags: [...headTags, ...headTagElements.map(renderToStaticMarkup), getStyleTag(customSheet)],
    markup: shimmedMarkup,
    reactQueryState: queryClientData,
  };
}
