import { Headers } from 'headers-utils/lib';
import jsesc from 'jsesc';
import { parseHTML, parseJSON, toJSON } from 'linkedom';
import type { jsdonValue } from 'linkedom/types/shared/parse-json';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { ChunkDependencies } from '../build/types';
import { DEFAULT_HTML_TEMPLATE, STATUS_CODES } from './constants';
import type { Request, Response } from './lifecycle';
import { Plugin, RendererPluginHost } from './plugin';

export type RootComponent = (props: any) => React.ReactElement;

export interface RenderOptions {
  deadline?: number;
  maxIterations?: number;
}

export interface RenderStats {
  latency: number;
  renderCount: number;
}

export interface ServerRendererOptions extends RenderOptions {
  appRoot: RootComponent;
  baseUrl?: string;
  chunkDependencies: ChunkDependencies;
  entrypointUrl: string;
  htmlTemplate?: string;
  isDevelopmentMode?: boolean;
  plugins?: Plugin[];
}

export class ServerRenderer {
  private readonly appRoot: RootComponent;
  private readonly baseUrl: string;
  private readonly defaultRenderDeadline: number;
  private readonly defaultMaxRenderIterations: number;
  private readonly entrypointUrl: string;
  private readonly htmlTemplateData: jsdonValue[];
  private readonly isDevelopmentMode: boolean;
  private readonly plugins: Plugin[];

  constructor(options: ServerRendererOptions) {
    this.appRoot = options.appRoot;
    this.baseUrl = ensureTrailingSlash(options.baseUrl ?? '/');
    this.defaultMaxRenderIterations = options.maxIterations ?? 3;
    this.defaultRenderDeadline = options.deadline ?? 500;
    this.entrypointUrl = options.entrypointUrl;
    this.isDevelopmentMode = options.isDevelopmentMode ?? false;
    this.plugins = options.plugins ?? [];
    this.htmlTemplateData = toJSON(
      parseHTML(options.htmlTemplate ?? DEFAULT_HTML_TEMPLATE).document
    );
  }

  async render(
    request: Request,
    options: RenderOptions = {}
  ): Promise<{ response: Response; stats: RenderStats }> {
    const start = Date.now();
    const deadline = options.deadline ?? this.defaultRenderDeadline;

    // We're going to give a maximum amount of time for this render.
    const deadlineAt = Date.now() + deadline;
    // We've given ourselves a deadline so let's get a Promise that will resolve
    // when the deadline is reached to race against data-loading promises (if any).
    const deadlinePromise = new Promise((r) => setTimeout(r, deadline));

    // This is the request-specific instance that will run all our plugins for us
    const pluginHost = new RendererPluginHost(this.plugins, {
      deadlineAt,
      renderMode: 'server',
      request,
      start,
    });

    const App = pluginHost.decorateApp(this.appRoot);
    const appEl = React.createElement(App);

    // We'll give ourselves a budget for the number of render passes we're willing to undertake
    let renderCount = 1;
    let renderedMarkup = '';

    // We'll give ourselves a budget for the number of async passes we're willing to undertake
    let remainingIterations = options.maxIterations ?? this.defaultMaxRenderIterations;

    try {
      renderedMarkup = renderToString(appEl);

      // Loop while we haven't exceeded our deadline or iteration budget and while we have pending queries
      for (
        ;
        // Condition
        Date.now() <= deadlineAt &&
        pluginHost.shouldContinueRendering() &&
        !pluginHost.shouldAbortRendering() &&
        remainingIterations;
        // Loop update (after loop block)
        remainingIterations--
      ) {
        // We're always going to race against our deadline promise so that we can interrupt potentially
        // earlier than the first query will settle.

        await Promise.race([deadlinePromise, ...pluginHost.getPendingOperations()]);

        // Re-render the page, triggering any new queries unlocked by the new state.
        renderedMarkup = renderToString(appEl);
        renderCount++;
      }
    } catch (err) {
      // TODO: Allow the RendererPluginHost to handle errors (somehow?)
      // TODO: Bake error into dev builds for devex
      if (this.isDevelopmentMode) {
        console.error(err);
      }
    }

    // TODO: Allow the RendererPluginHost to short-circuit the request (ie: redirects).

    // Any outstanding queries should be cancelled at this point since our client's lifetime
    // is limited to this request anyway.
    await pluginHost.cancelPendingOperations();

    // Create a cloned document from our serialized template
    const document = (parseJSON(this.htmlTemplateData) as unknown) as HTMLDocument;

    // Create and inject the root div to which our app will be mounted
    const rootDiv = document.createElement('div');
    rootDiv.id = 'root';
    rootDiv.innerHTML = renderedMarkup;
    document.body.appendChild(rootDiv);

    pluginHost.renderHtml(document);

    const pluginBootstrapData = pluginHost.getBootstrapData();
    const bootstrapScript = `
const baseUrl = new URL(
  ${jsesc(this.baseUrl, {
    isScriptContext: true,
    json: true,
  })},
  window.location.href
);
const entrypointUrl = new URL(
  ${jsesc(this.entrypointUrl, {
    isScriptContext: true,
    json: true,
  })},
  baseUrl
);
import(entrpointUrl.href)
  .then((clientRenderer) => {
    clientRenderer.render({
      pluginBootstrapData: ${jsesc(pluginBootstrapData, {
        isScriptContext: true,
      })},
    });
  }, (err: unknown) => {
    // TODO: Handle error
    console.error(err);
  });
    `;
    const bootstrapScriptEl = document.createElement('script');
    bootstrapScriptEl.appendChild(document.createTextNode(bootstrapScript));
    bootstrapScriptEl.async = true;
    bootstrapScriptEl.defer = true;
    bootstrapScriptEl.type = 'module';
    document.body.appendChild(bootstrapScriptEl);

    const headers = new Headers();
    const body = document.toString();

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

function ensureTrailingSlash(str: string): string {
  return str.endsWith('/') ? str : `${str}/`;
}
