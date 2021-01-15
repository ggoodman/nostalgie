import Boom from '@hapi/boom';
import typography from '@twind/typography';
import {
  BootstrapOptions,
  ChunkManager,
  FilledContext,
  HelmetProvider,
  LazyContext,
  ProviderProps,
  QueryClient,
  ServerFunction,
  ServerFunctionContext,
  ServerQueryContextProvider,
  ServerQueryExecutorImpl,
  StaticRouter,
} from 'nostalgie/internals';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { dehydrate, Hydrate } from 'react-query/hydration';
import { create, silent } from 'twind';
import { getStyleTag, shim, virtualSheet } from 'twind/server';
import { worker } from 'workerpool';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import App from '__nostalgie_app__';
// @ts-ignore
// We need to ignore this because the import specifier
// will be remapped at build time.
import * as Functions from '__nostalgie_functions__';
export { HelmetProvider } from 'react-helmet-async';
// import { MethodKind } from './constants';

declare const App: React.ComponentType;
declare const Functions: { [functionName: string]: ServerFunction | undefined };

declare const __nostalgie_chunks__: any;

const MAX_ASYNC_PREPASS_ITERATIONS = 20;

worker({
  invokeFunction,
  renderAppOnServer,
});

export async function invokeFunction(
  functionName: string,
  ctx: ServerFunctionContext,
  args: any[]
) {
  const functionImpl = Functions[functionName] as ServerFunction | undefined;

  if (!functionImpl) {
    throw Boom.notFound();
  }

  return functionImpl(ctx, ...args);
}

export async function renderAppOnServer(
  path: string,
  deadline: number = 500
): Promise<{ html: string }> {
  const helmetCtx: ProviderProps = {};
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
  const queryExecutor = new ServerQueryExecutorImpl(queryClient);
  const model = (
    <StaticRouter location={path}>
      <LazyContext.Provider value={chunkCtx}>
        <ServerQueryContextProvider queryExecutor={queryExecutor}>
          <Hydrate state={initialReactQueryState}>
            <HelmetProvider context={helmetCtx}>
              <App />
            </HelmetProvider>
          </Hydrate>
        </ServerQueryContextProvider>
      </LazyContext.Provider>
    </StaticRouter>
  );

  try {
    // We're going to give a maximum amount of time for this render.
    const deadlineAt = Date.now() + deadline;
    // We've given ourselves a deadline so let's get a Promise that will resolve
    // when the deadline is reached to race against data-loading promises (if any).
    const deadlinePromise = new Promise((r) => setTimeout(r, deadline));

    // A first SSR async pass through the tree for critical stuff like dynamic imports
    // await ssrPrepass(model);

    // We'll give ourselves a budget for the number of async passes we're willing to undertake
    let remainingIterations = MAX_ASYNC_PREPASS_ITERATIONS;

    let html: string | undefined = renderToString(model);
    let renderCount = 1;

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
        renderCount++;
        // await ssrPrepass(model);
      } catch {
        // Break out and do the final rendering
        break;
      }
    }

    // Any outstanding queries should be cancelled at this point since our client's lifetime
    // is limited to this request anyway.
    const queryClientData = dehydrate(queryClient);
    const renderedMarkup = html ?? (renderCount++, renderToString(model));

    console.log('RENDER COUNT', renderCount, path);

    // They didn't make it in time for the deadline so we'll cancel them
    queryClient.cancelQueries();

    // We need to reset the sheet _right before_ rendering even if single-use 🤷‍♂️
    customSheet.reset();

    const shimmedMarkup = shim(renderedMarkup, tw);
    const headTags = [];

    const { helmet } = helmetCtx as FilledContext;

    for (const { chunk } of chunkCtx.chunks) {
      const chunkDeps = chunkDependencies[chunk];

      if (chunkDeps) {
        for (const chunkDep of chunkDeps) {
          headTags.push(`<link rel="modulepreload" href="${chunkDep}">`);
        }
      }
    }

    const publicUrl = encodeURI('');
    const htmlAttrs = helmet.htmlAttributes.toString();
    const bodyAttrs = helmet.bodyAttributes.toString();

    const bootstrapOptions: BootstrapOptions = {
      lazyComponents: chunkCtx.chunks,
      reactQueryState: queryClientData,
    };
    const wrapper = `
  <!doctype html>
  <html ${htmlAttrs}>
    <head>
      ${helmet.title.toString()}
      ${helmet.meta.toString()}
      <link rel="modulepreload" href="${publicUrl}/static/build/bootstrap.js" />
      ${chunkCtx.chunks.map(
        ({ chunk }) => `<link rel="modulepreload" href="${publicUrl}/${encodeURI(chunk)}" />`
      )}
      ${helmet.link.toString()}
      ${headTags.join('\n')}
      ${helmet.noscript.toString()}
      ${helmet.script.toString()}
      ${getStyleTag(customSheet)}
      ${helmet.style.toString()}
    </head>
    <body ${bodyAttrs}>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root">${shimmedMarkup}</div>
      <script async type="module">
        import { start } from "${publicUrl}/static/build/bootstrap.js";
  
        start(${JSON.stringify(bootstrapOptions)});
      </script>
    </body>
  </html>
        `.trim();

    return {
      html: wrapper,
    };
  } catch (e) {
    return {
      html: e.stack,
    };
  }
}
