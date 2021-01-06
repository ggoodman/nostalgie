import * as React from 'react';
//@ts-ignore
import { renderToStringAsync } from 'react-lightyear/server';
import { StaticRouter } from 'react-router-dom';
import { create, Sheet, silent } from 'twind';
import { shim } from 'twind/server';
import { ChunkManager, LazyContext } from 'nostalgie/internals';

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
  });

  const markup: string = shim(
    await renderToStringAsync(
      <LazyContext.Provider value={chunkCtx}>
        <StaticRouter location={path} context={context}>
          <App />
        </StaticRouter>
      </LazyContext.Provider>
    ),
    tw
  );
  const initialRules = target.join('\n');

  return {
    preloadScripts: [...chunkCtx.chunks],
    headTags: [`<style id="__twind" type="text/css">${initialRules}</style>`],
    markup,
  };
}
