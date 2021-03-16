import { Route, RouteDefinition, Router, SpecialRoute } from '@hapi/call';
//@ts-ignore
import { Definitions } from '@hapi/statehood';
import { htmlEscape } from 'escape-goat';
import { Headers } from 'headers-utils';
import jsesc from 'jsesc';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import * as ReactHelmetAsync from 'react-helmet-async';
import * as ReactQuery from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import type * as ReactRouter from 'react-router';
import type { ChunkDependencies } from './build/types';
import { ServerQueryExecutorImpl } from './runtime/functions/server';
import type { ChunkManager } from './runtime/lazy/types';
import { defaultMarkupProps } from './runtime/markup';

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

type RootComponent = (props: any) => React.ReactElement;

export interface RenderStats {
  latency: number;
  renderCount: number;
}

export interface RenderOptions {
  deadline?: number;
  maxIterations?: number;
}

export interface ServerRendererOptions extends RenderOptions {
  appRoot: RootComponent;
  chunkDependencies: ChunkDependencies;
  isDevelopmentMode?: boolean;
}

export class ServerRenderer {
  private readonly appRoot: RootComponent;
  private readonly chunkDependencies: ChunkDependencies;
  private readonly defaultRenderDeadline: number;
  private readonly defaultMaxRenderIterations: number;
  private readonly isDevelopmentMode: boolean;

  constructor(options: ServerRendererOptions) {
    this.appRoot = options.appRoot;
    this.chunkDependencies = options.chunkDependencies;
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
        <ReactHelmetAsync.Helmet {...defaultMarkupProps} />
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

export interface NostalgieRuntimeOptions {
  cookieSecret: string;
  baseUrl: string;
  rootComponent: RootComponent;
}

export class Nostalgie {
  private readonly baseUrlPrefix = '/';
  private readonly cookieDefinitions = new Definitions({ ignoreErrors: true });

  private readonly router = new TypedRouter<NostalgieRoute>({
    isCaseSensitive: true,
  });

  constructor(options: NostalgieRuntimeOptions) {
    this.cookieDefinitions.add('nsid', {
      encoding: 'iron',
      ttl: 1000 * 60 * 60 * 24 * 7 * 4, // 4 weeks
      password: options.cookieSecret,
      path: '/',
      isSecure: process.env.NODE_ENV !== 'development',
    });

    this.router.special('badRequest', {
      handler: this.onBadRequest.bind(this),
    });

    this.router.special('notFound', {
      handler: this.onNotFoundRequest.bind(this),
    });

    this.router.add(
      {
        method: 'POST',
        path: `${this.baseUrlPrefix}.nostalgie/rpc`,
      },
      {
        handler: this.onRpc.bind(this),
      }
    );

    this.router.add(
      {
        method: '*',
        path: `${this.baseUrlPrefix}.nostalgie/{any*}`,
      },
      {
        handler: this.onNotFoundRequest.bind(this),
      }
    );

    this.router.add(
      {
        method: 'get',
        path: `${this.baseUrlPrefix}{any*}`,
      },
      {
        handler: this.onAppRoute.bind(this),
      }
    );
  }

  private async onAppRoute(request: Request): Promise<Response> {
    const { states, failed } = await this.cookieDefinitions.parse(
      request.headers.get('cookie') || ''
    );

    console.dir({ states, failed });

    return {
      body: 'App',
      headers: new Headers(),
      status: 200,
    };
  }

  private async onBadRequest(request: Request): Promise<Response> {
    return {
      body: '',
      headers: new Headers(),
      status: 400,
    };
  }

  private async onNotFoundRequest(request: Request): Promise<Response> {
    return {
      body: '',
      headers: new Headers(),
      status: 404,
    };
  }

  private async onRpc(request: Request): Promise<Response> {
    return {
      body: request.body,
      headers: new Headers(),
      status: 200,
    };
  }

  async handleRequest(request: Request): Promise<Response> {
    // TODO: @ggoodman vhost routing?
    const route = this.router.route(request.method.toLowerCase(), request.path);

    if (route instanceof Error) {
      throw new InvariantViolation('A route should _always_ be found');
    }

    return route.route.handler(request);

    // const { states, failed } = await this.cookieDefinitions.parse(
    //   request.headers.get('cookie') || ''
    // );

    // console.dir({ states, failed });

    // const headers = new Headers({});

    // return {
    //   body: '',
    //   headers,
    //   status: 200,
    //   statusText: STATUS_CODES['200'],
    // };
  }
}

export interface NostalgieRoute {
  handler(request: Request): Response | Promise<Response>;
}

declare module '@hapi/call' {
  export interface RouteDefinition {
    vhost?: string;
  }

  export interface Router {
    add(definition: RouteDefinition, data: any): void;
    route(method: string, path: string, vhost?: string): Route;
    special(special: SpecialRoute, data: any): void;
  }

  export type SpecialRoute = 'badRequest' | 'notFound' | 'options';
}

class TypedRouter<T> extends Router {
  add(definition: RouteDefinition, data: T) {
    return super.add(definition, data);
  }

  route(method: string, path: string, vhost?: string): Route<Record<string, unknown>, T> {
    return super.route(method, path, vhost);
  }

  special(special: SpecialRoute, data: T) {
    return super.special(special, data);
  }
}

class InvariantViolation extends Error {}

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

const STATUS_CODES: Record<number, string> = {
  100: 'Continue', // RFC 7231 6.2.1
  101: 'Switching Protocols', // RFC 7231 6.2.2
  102: 'Processing', // RFC 2518 10.1 (obsoleted by RFC 4918)
  103: 'Early Hints', // RFC 8297 2
  200: 'OK', // RFC 7231 6.3.1
  201: 'Created', // RFC 7231 6.3.2
  202: 'Accepted', // RFC 7231 6.3.3
  203: 'Non-Authoritative Information', // RFC 7231 6.3.4
  204: 'No Content', // RFC 7231 6.3.5
  205: 'Reset Content', // RFC 7231 6.3.6
  206: 'Partial Content', // RFC 7233 4.1
  207: 'Multi-Status', // RFC 4918 11.1
  208: 'Already Reported', // RFC 5842 7.1
  226: 'IM Used', // RFC 3229 10.4.1
  300: 'Multiple Choices', // RFC 7231 6.4.1
  301: 'Moved Permanently', // RFC 7231 6.4.2
  302: 'Found', // RFC 7231 6.4.3
  303: 'See Other', // RFC 7231 6.4.4
  304: 'Not Modified', // RFC 7232 4.1
  305: 'Use Proxy', // RFC 7231 6.4.5
  307: 'Temporary Redirect', // RFC 7231 6.4.7
  308: 'Permanent Redirect', // RFC 7238 3
  400: 'Bad Request', // RFC 7231 6.5.1
  401: 'Unauthorized', // RFC 7235 3.1
  402: 'Payment Required', // RFC 7231 6.5.2
  403: 'Forbidden', // RFC 7231 6.5.3
  404: 'Not Found', // RFC 7231 6.5.4
  405: 'Method Not Allowed', // RFC 7231 6.5.5
  406: 'Not Acceptable', // RFC 7231 6.5.6
  407: 'Proxy Authentication Required', // RFC 7235 3.2
  408: 'Request Timeout', // RFC 7231 6.5.7
  409: 'Conflict', // RFC 7231 6.5.8
  410: 'Gone', // RFC 7231 6.5.9
  411: 'Length Required', // RFC 7231 6.5.10
  412: 'Precondition Failed', // RFC 7232 4.2
  413: 'Payload Too Large', // RFC 7231 6.5.11
  414: 'URI Too Long', // RFC 7231 6.5.12
  415: 'Unsupported Media Type', // RFC 7231 6.5.13
  416: 'Range Not Satisfiable', // RFC 7233 4.4
  417: 'Expectation Failed', // RFC 7231 6.5.14
  418: "I'm a Teapot", // RFC 7168 2.3.3
  421: 'Misdirected Request', // RFC 7540 9.1.2
  422: 'Unprocessable Entity', // RFC 4918 11.2
  423: 'Locked', // RFC 4918 11.3
  424: 'Failed Dependency', // RFC 4918 11.4
  425: 'Too Early', // RFC 8470 5.2
  426: 'Upgrade Required', // RFC 2817 and RFC 7231 6.5.15
  428: 'Precondition Required', // RFC 6585 3
  429: 'Too Many Requests', // RFC 6585 4
  431: 'Request Header Fields Too Large', // RFC 6585 5
  451: 'Unavailable For Legal Reasons', // RFC 7725 3
  500: 'Internal Server Error', // RFC 7231 6.6.1
  501: 'Not Implemented', // RFC 7231 6.6.2
  502: 'Bad Gateway', // RFC 7231 6.6.3
  503: 'Service Unavailable', // RFC 7231 6.6.4
  504: 'Gateway Timeout', // RFC 7231 6.6.5
  505: 'HTTP Version Not Supported', // RFC 7231 6.6.6
  506: 'Variant Also Negotiates', // RFC 2295 8.1
  507: 'Insufficient Storage', // RFC 4918 11.5
  508: 'Loop Detected', // RFC 5842 7.2
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended', // RFC 2774 7
  511: 'Network Authentication Required', // RFC 6585 6
};
