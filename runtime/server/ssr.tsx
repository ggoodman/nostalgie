import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeadProvider, Style } from 'react-head';
//@ts-ignore
import { renderToStringAsync as renderToStringAsyncLightyear } from 'react-lightyear/server';
//@ts-ignore
import { renderToStringAsync } from 'react-async-ssr';
import { StaticRouter } from 'react-router-dom';
import { create, Sheet, silent } from 'twind';
import { shim } from 'twind/server';
import { ChunkManager, LazyContext } from 'nostalgie/internals';
import typography from '@twind/typography';

export async function renderAppOnServer(App: React.ComponentType, path: string) {
  const context = {};
  const chunkCtx: ChunkManager = {
    chunks: new Map(),
    lazyComponentState: new Map(),
  };

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
  const headTags: React.ReactElement<unknown>[] = [];

  const markup = await renderToStringAsyncLightyear(
    <LazyContext.Provider value={chunkCtx}>
      <HeadProvider headTags={headTags}>
        <StaticRouter location={path} context={context}>
          <App />
        </StaticRouter>
      </HeadProvider>
    </LazyContext.Provider>
  );

  const shimmedMarkup = shim(markup, tw);
  const initialRules = target.join('\n');

  return {
    preloadScripts: [...chunkCtx.chunks],
    headTags: [
      ...headTags.map(renderToStaticMarkup),
      `<style id="__twind">${initialRules}</style>`,
    ],
    markup: shimmedMarkup,
  };
}
