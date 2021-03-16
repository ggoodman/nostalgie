import { htmlEscape } from 'escape-goat';
import { Headers } from 'headers-utils';
import jsesc from 'jsesc';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import * as ReactHelmetAsync from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import type * as ReactRouter from 'react-router';
import type { ChunkDependencies } from '../build/types';
import { ServerQueryExecutorImpl } from '../runtime/functions/server';
import type { ChunkManager } from '../runtime/lazy/types';
import type { MarkupProps } from '../runtime/markup';
import { DEFAULT_MARKUP_PROPS, STATUS_CODES } from './constants';

export type HttpMethod = 'get' | 'put' | 'post' | 'patch' | 'delete';

export interface Request {
  path: string;
  method: HttpMethod;
  headers: Headers;
  body: unknown;
}

export interface Response {
  headers: Headers;
  status: number;
  statusText?: string;
  body: unknown;
}

export type RootComponent = (props: any) => React.ReactElement;

export interface RenderOptions {
  deadline?: number;
  markupProps?: MarkupProps;
  maxIterations?: number;
}

export interface RenderStats {
  latency: number;
  renderCount: number;
}

export interface ServerRendererOptions extends RenderOptions {
  appRoot: RootComponent;
  chunkDependencies: ChunkDependencies;
  isDevelopmentMode?: boolean;
}

export class ServerRenderer {
  private readonly appRoot: RootComponent;
  private readonly chunkDependencies: ChunkDependencies;
  private readonly defaultMarkupProps: MarkupProps;
  private readonly defaultRenderDeadline: number;
  private readonly defaultMaxRenderIterations: number;
  private readonly isDevelopmentMode: boolean;

  constructor(options: ServerRendererOptions) {
    this.appRoot = options.appRoot;
    this.chunkDependencies = options.chunkDependencies;
    this.defaultMarkupProps = { ...DEFAULT_MARKUP_PROPS, ...options.markupProps };
    this.defaultMaxRenderIterations = options.maxIterations ?? 3;
    this.defaultRenderDeadline = options.deadline ?? 500;
    this.isDevelopmentMode = options.isDevelopmentMode ?? false;
  }

  private onBeforeRender() {}

  async render(
    request: Request,
    options: RenderOptions = {}
  ): Promise<{ response: Response; stats: RenderStats }> {
    const start = Date.now();
    const deadline = options.deadline ?? this.defaultRenderDeadline;
    const bootstrapChunk = 'static/build/bootstrap.js';
    const markupCtx: ReactHelmetAsync.ProviderProps = {};
    const markupProps = { ...this.defaultMarkupProps, ...options.markupProps };
    const chunkCtx: ChunkManager = {
      chunks: [],
      lazyComponentState: new Map(),
    };
    const queryClient = new ReactQuery.QueryClient();
    // const initialReactQueryState = ReactQueryHydration.dehydrate(queryClient);
    const auth = {} as any;
    const queryExecutor = new ServerQueryExecutorImpl({ auth, queryClient });
    const routerCtx: ReactRouter.StaticRouterContext = {};

    const App = (
      <ReactHelmetAsync.HelmetProvider context={markupCtx}>
        <ReactHelmetAsync.Helmet {...markupProps} />
        <this.appRoot />
      </ReactHelmetAsync.HelmetProvider>
    );

    // We'll give ourselves a budget for the number of render passes we're willing to undertake
    let renderCount = 1;
    let renderedMarkup = '';

    // We're going to give a maximum amount of time for this render.
    const deadlineAt = Date.now() + deadline;
    // We've given ourselves a deadline so let's get a Promise that will resolve
    // when the deadline is reached to race against data-loading promises (if any).
    const deadlinePromise = new Promise((r) => setTimeout(r, deadline));

    // A first SSR async pass through the tree for critical stuff like dynamic imports
    // await ssrPrepass(model);

    // We'll give ourselves a budget for the number of async passes we're willing to undertake
    let remainingIterations = options.maxIterations ?? this.defaultMaxRenderIterations;

    this.onBeforeRender();

    try {
      renderedMarkup = renderToString(App);

      // Loop while we haven't exceeded our deadline or iteration budget and while we have pending queries
      for (
        ;
        // Condition
        Date.now() <= deadlineAt &&
        queryExecutor.promises.size &&
        remainingIterations &&
        !routerCtx.url &&
        !routerCtx.statusCode;
        // Loop update (after loop block)
        remainingIterations--
      ) {
        // We're always going to race against our deadline promise so that we can interrupt potentially
        // earlier than the first query will settle.
        await Promise.race([deadlinePromise, ...queryExecutor.promises]);

        // Re-render the page, triggering any new queries unlocked by the new state.
        this.onBeforeRender();
        renderedMarkup = renderToString(App);
        renderCount++;
      }
    } catch (err) {
      // TODO: Bake error into dev builds for devex
      if (this.isDevelopmentMode) {
        console.error(err);
      }
    }

    const headers = new Headers();

    if (routerCtx.url) {
      const status = routerCtx.statusCode || 302;

      headers.set('location', routerCtx.url);

      return {
        response: {
          body: `<p>You are being redirected to ${htmlEscape(routerCtx.url)}</p>`,
          headers,
          status,
          statusText: STATUS_CODES[status],
        },
        stats: {
          renderCount,
          latency: Date.now() - start,
        },
      };
    }

    // Any outstanding queries should be cancelled at this point since our client's lifetime
    // is limited to this request anyway.
    queryClient.cancelQueries();

    const queryClientData = ReactQueryHydration.dehydrate(queryClient);

    const headTags = [];

    const { helmet } = markupCtx as ReactHelmetAsync.FilledContext;
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

    const bootstrapOptions = {
      lazyComponents: chunkCtx.chunks,
      publicUrl,
      reactQueryState: queryClientData,
    };
    const body = `
<!doctype html>
<html ${htmlAttrs}>
<head>
${helmet.title.toString()}
${helmet.meta.toString()}
<link rel="modulepreload" href="${publicUrl}static/build/bootstrap.js" />
${chunkCtx.chunks
  .map(({ chunk }) => `<link rel="modulepreload" href="${publicUrl}${encodeURI(chunk)}" />`)
  .join('\n')}
${helmet.link.toString()}
${headTags.join('\n')}
${helmet.noscript.toString()}
${helmet.script.toString()}
${helmet.style.toString()}
</head>
<body ${bodyAttrs}>
<div id="root">${renderedMarkup}</div>
<script async type="module">
import { start } from "${publicUrl}static/build/bootstrap.js";
start(${jsesc(bootstrapOptions, { es6: true, isScriptContext: true, minimal: true })});
</script>
</body>
</html>`.trim();

    return {
      response: {
        body,
        headers,
        status: 200,
        statusText: STATUS_CODES[200],
      },
      stats: {
        latency: Date.now() - start,
        renderCount,
      },
    };
  }
}
