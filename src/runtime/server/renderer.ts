import Boom from '@hapi/boom';
import TwindTypography from '@twind/typography';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import * as Helmet from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import * as ReactRouterDOM from 'react-router-dom';
import * as Twind from 'twind';
import * as TwindServer from 'twind/server';
import type { ChunkDependencies } from '../../build/types';
import type { BootstrapOptions } from '../bootstrap/bootstrap';
import { ServerQueryContextProvider, ServerQueryExecutorImpl } from '../functions/server';
import type { ServerFunction, ServerFunctionContext } from '../functions/types';
import { defaultHelmetProps } from '../helmet';
import { LazyContext } from '../lazy/context';
import type { ChunkManager } from '../lazy/types';

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
    path: string
  ): Promise<{ html: string; renderCount: number; latency: number }> {
    const start = Date.now();
    const helmetCtx: Helmet.ProviderProps = {};
    const chunkCtx: ChunkManager = {
      chunks: [],
      lazyComponentState: new Map(),
    };
    const queryClient = new ReactQuery.QueryClient();
    const initialReactQueryState = ReactQueryHydration.dehydrate(queryClient);
    const queryExecutor = new ServerQueryExecutorImpl(queryClient);
    const model = React.createElement(
      ReactRouterDOM.StaticRouter,
      { location: path },
      React.createElement(
        LazyContext.Provider,
        { value: chunkCtx },
        React.createElement(
          ServerQueryContextProvider,
          { queryExecutor: queryExecutor },
          React.createElement(
            ReactQueryHydration.Hydrate,
            { state: initialReactQueryState },
            React.createElement(
              Helmet.HelmetProvider,
              { context: helmetCtx },
              React.createElement(Helmet.Helmet, defaultHelmetProps),
              React.createElement(this.app)
            )
          )
        )
      )
    );

    // We'll give ourselves a budget for the number of render passes we're willing to undertake
    let renderCount = 1;

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

      // Any outstanding queries should be cancelled at this point since our client's lifetime
      // is limited to this request anyway.
      const queryClientData = ReactQueryHydration.dehydrate(queryClient);
      const renderedMarkup = html ?? (renderCount++, renderToString(model));

      // They didn't make it in time for the deadline so we'll cancel them
      queryClient.cancelQueries();

      // Set up twind for parsing the result and generating markup
      const customSheet = TwindServer.virtualSheet();
      const { tw } = Twind.create({
        sheet: customSheet,
        mode: Twind.silent,
        prefix: true,
        plugins: {
          ...TwindTypography(),
        },
      });
      // We need to reset the sheet _right before_ rendering even if single-use 🤷‍♂️
      customSheet.reset();

      const shimmedMarkup = TwindServer.shim(renderedMarkup, tw);
      const headTags = [];

      const { helmet } = helmetCtx as Helmet.FilledContext;

      for (const { chunk } of chunkCtx.chunks) {
        const chunkDeps = this.chunkDependencies[chunk];

        if (chunkDeps) {
          for (const chunkDep of chunkDeps) {
            headTags.push(`<link rel="modulepreload" href="${chunkDep}">`);
          }
        }
      }

      const publicUrl = encodeURI('/');
      const htmlAttrs = helmet.htmlAttributes.toString();
      const bodyAttrs = helmet.bodyAttributes.toString();

      const bootstrapOptions: BootstrapOptions = {
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
    </html>
          `.trim();

      return {
        html: wrapper,
        renderCount: renderCount,
        latency: Date.now() - start,
      };
    } catch (e) {
      return {
        html: e.stack,
        renderCount: renderCount,
        latency: Date.now() - start,
      };
    }
  }
}
