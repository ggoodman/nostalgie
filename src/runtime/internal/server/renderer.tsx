import Boom from '@hapi/boom';
import TwindTypography from '@twind/typography';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import * as Helmet from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import * as ReactRouterDOM from 'react-router-dom';
import { install } from 'source-map-support';
import * as Twind from 'twind';
import * as TwindServer from 'twind/shim/server';
import type { ChunkDependencies } from '../../../build/types';
import type { ClientAuth } from '../../auth';
import { AuthContext, ServerAuth } from '../../auth/server';
import { ServerQueryContextProvider, ServerQueryExecutorImpl } from '../../functions/server';
import type { ServerFunction, ServerFunctionContext } from '../../functions/types';
import { defaultHelmetProps } from '../../helmet';
import { LazyContext } from '../../lazy/context';
import type { ChunkManager } from '../../lazy/types';
import { TwindContext } from '../../styling/internal';
import type { BootstrapOptions } from '../bootstrap/bootstrap';

declare global {
  var __nostalgie_css: (buildPath: string, css: string) => void;
}

// const injectedCss = new Map<string, string>();
// global.__nostalgie_css = (buildPath: string, css: string) => {
//   injectedCss.set(buildPath, css);
// }

if (process.env.NODE_ENV === 'development') {
  install({
    environment: 'node',
  });
}

export interface ServerRenderRequest {
  auth: ServerAuth;
  automaticReload?: boolean;
  path: string;
}

interface ServerRendererSettings {
  defaultDeadline: number;
  maxIterations: number;
}

export interface ServerRendererOptions extends Partial<ServerRendererSettings> {}

export class ServerRenderer {
  private readonly app: React.ComponentType;
  private readonly functions: Record<string, ServerFunction | undefined>;
  private readonly chunkDependencies: ChunkDependencies;
  private readonly settings: ServerRendererSettings;

  constructor(
    app: React.ComponentType,
    functions: Record<string, ServerFunction>,
    chunkDependencies: ChunkDependencies,
    options: ServerRendererOptions = {}
  ) {
    this.app = app;
    this.functions = functions;
    this.chunkDependencies = chunkDependencies;
    this.settings = {
      defaultDeadline: options.defaultDeadline ?? 500,
      maxIterations: options.maxIterations ?? 5,
    };
  }

  async invokeFunction(functionName: string, ctx: ServerFunctionContext, args: any[]) {
    const functionImpl = this.functions[functionName] as ServerFunction | undefined;

    if (!functionImpl) {
      throw Boom.notFound();
    }

    return functionImpl(ctx, ...args);
  }

  async renderAppOnServer(
    request: ServerRenderRequest
  ): Promise<{ html: string; renderCount: number; latency: number }> {
    const start = Date.now();
    const bootstrapChunk = 'static/build/bootstrap.js';
    const helmetCtx: Helmet.ProviderProps = {};
    const chunkCtx: ChunkManager = {
      chunks: [],
      lazyComponentState: new Map(),
    };
    const queryClient = new ReactQuery.QueryClient();
    const initialReactQueryState = ReactQueryHydration.dehydrate(queryClient);
    const auth = this.serverAuthToClientAuth(request.auth);
    const queryExecutor = new ServerQueryExecutorImpl({ auth: request.auth, queryClient });
    // Set up twind for parsing the result and generating markup
    const customSheet = TwindServer.virtualSheet();
    const { tw } = Twind.create({
      sheet: customSheet,
      mode: 'silent',
      prefix: true,
      preflight: true,
      plugins: {
        ...TwindTypography(),
      },
    });
    // We need to reset the sheet _right before_ rendering even if single-use 🤷‍♂️
    customSheet.reset();

    const model = (
      <TwindContext.Provider value={tw}>
        <LazyContext.Provider value={chunkCtx}>
          <ServerQueryContextProvider queryExecutor={queryExecutor}>
            <ReactQueryHydration.Hydrate state={initialReactQueryState}>
              <Helmet.HelmetProvider context={helmetCtx}>
                <AuthContext.Provider value={auth}>
                  <ReactRouterDOM.StaticRouter location={request.path}>
                    <Helmet.Helmet {...defaultHelmetProps}></Helmet.Helmet>
                    <this.app />
                  </ReactRouterDOM.StaticRouter>
                </AuthContext.Provider>
              </Helmet.HelmetProvider>
            </ReactQueryHydration.Hydrate>
          </ServerQueryContextProvider>
        </LazyContext.Provider>
      </TwindContext.Provider>
    );

    // We'll give ourselves a budget for the number of render passes we're willing to undertake
    let renderCount = 1;
    let renderedMarkup = '';

    try {
      // We're going to give a maximum amount of time for this render.
      const deadlineAt = Date.now() + this.settings.defaultDeadline;
      // We've given ourselves a deadline so let's get a Promise that will resolve
      // when the deadline is reached to race against data-loading promises (if any).
      const deadlinePromise = new Promise((r) => setTimeout(r, this.settings.defaultDeadline));

      // A first SSR async pass through the tree for critical stuff like dynamic imports
      // await ssrPrepass(model);

      // We'll give ourselves a budget for the number of async passes we're willing to undertake
      let remainingIterations = this.settings.maxIterations;

      let html: string | undefined = renderToString(model);

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

      renderedMarkup = html ?? (renderCount++, renderToString(model));
    } catch (err) {
      // TODO: Bake error into dev builds for devex
    }
    // Any outstanding queries should be cancelled at this point since our client's lifetime
    // is limited to this request anyway.
    const queryClientData = ReactQueryHydration.dehydrate(queryClient);
    renderedMarkup ??= (renderCount++, renderToString(model));

    // They didn't make it in time for the deadline so we'll cancel them
    queryClient.cancelQueries();

    const shimmedMarkup = TwindServer.shim(renderedMarkup, {
      tw: tw as any,
      lowerCaseTagName: false,
      comment: false,
      blockTextElements: {
        script: true,
        noscript: true,
        style: true,
        pre: true,
      },
    });
    const headTags = [];

    const { helmet } = helmetCtx as Helmet.FilledContext;
    const requiredChunks = [bootstrapChunk, ...chunkCtx.chunks.map((chunk) => chunk.chunk)];
    const seenChunks = new Set();

    while (requiredChunks.length) {
      const chunk = requiredChunks.shift()!;

      // Make sure we don't process twice
      if (seenChunks.has(chunk)) continue;
      seenChunks.add(chunk);

      const chunkDeps = this.chunkDependencies[chunk];

      if (chunkDeps) {
        for (const chunkDep of chunkDeps.modules) {
          headTags.push(`<link rel="modulepreload" href="${chunkDep}">`);
          // Capture transitive dependencies
          // Chunk dependencies are stored as absolute paths. We need to trim
          // the leading '/` or it won't match the key format
          requiredChunks.push(chunkDep.slice(1));
        }
        for (const chunkDep of chunkDeps.styles) {
          headTags.push(
            `<style data-ns-css=${JSON.stringify(chunkDep.relPath)}>${chunkDep.css}</style>`
          );
        }
      }
    }

    const publicUrl = encodeURI('/');
    const htmlAttrs = helmet.htmlAttributes.toString();
    const bodyAttrs = helmet.bodyAttributes.toString();

    const bootstrapOptions: BootstrapOptions = {
      auth: this.serverAuthToClientAuth(request.auth),
      automaticReload: request.automaticReload,
      // errStack: errStack || undefined,
      lazyComponents: chunkCtx.chunks,
      publicUrl,
      reactQueryState: queryClientData,
    };
    const wrapper = `
<!doctype html>
<html ${htmlAttrs}>
<head>
${helmet.title.toString()}
${helmet.meta.toString()}
<link rel="modulepreload" href="${publicUrl}static/build/bootstrap.js" />
${chunkCtx.chunks.map(
  ({ chunk }) => `<link rel="modulepreload" href="${publicUrl}${encodeURI(chunk)}" />`
)}
${helmet.link.toString()}
${headTags.join('\n')}
${helmet.noscript.toString()}
${helmet.script.toString()}
${TwindServer.getStyleTag(customSheet)}
${helmet.style.toString()}
</head>
<body ${bodyAttrs}>
<div id="root">${shimmedMarkup}</div>
<script async type="module">
import { start } from "${publicUrl}static/build/bootstrap.js";
start(${JSON.stringify(bootstrapOptions)});
</script>
</body>
</html>`.trim();

    return {
      html: wrapper,
      renderCount: renderCount,
      latency: Date.now() - start,
    };
  }

  private serverAuthToClientAuth(auth: ServerAuth): ClientAuth {
    return auth.isAuthenticated
      ? {
          isAuthentiated: auth.isAuthenticated,
          credentials: auth.credentials,
          loginUrl: '/.nostalgie/login',
          logoutUrl: '/.nostalgie/logout',
        }
      : {
          isAuthentiated: false,
          error: auth.error,
          loginUrl: '/.nostalgie/login',
          logoutUrl: '/.nostalgie/logout',
        };
  }
}
