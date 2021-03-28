import { createDispatcher, HoofdProvider } from 'hoofd';
import * as React from 'react';
import type { Plugin } from '../plugin';

type Dispatcher = ReturnType<typeof createDispatcher>;

export function htmlPlugin(): Plugin<Dispatcher> {
  return {
    name: 'htmlPlugin',
    createState: () => {
      return createDispatcher();
    },
    decorateApp(ctx, app) {
      return () =>
        React.createElement(HoofdProvider, { value: ctx.state }, React.createElement(app));
    },
    renderHtml(ctx, document) {
      const { lang, links, metas, scripts, title } = ctx.state.toStatic();

      if (lang) {
        document.documentElement.setAttribute('lang', lang);
      }

      if (title) {
        document.title = title;
      }

      for (const meta of metas) {
        const metaEl = document.createElement('meta');

        for (const attr in meta) {
          metaEl.setAttribute(attr, meta[attr as keyof typeof meta]!);
        }

        document.head.appendChild(metaEl);
      }

      for (const link of links) {
        const linkEl = document.createElement('link');

        for (const attr in link) {
          linkEl.setAttribute(attr, link[attr]);
        }

        document.head.appendChild(linkEl);
      }

      for (const script of scripts) {
        const scriptEl = document.createElement('script');

        for (const attr in script) {
          scriptEl.setAttribute(attr, script[attr]);
        }

        document.head.appendChild(scriptEl);
      }
    },
  };
}
