import { createElement } from 'react';
import { StaticRouter } from 'react-router-dom/server';
import type { ServerPlugin } from '../../server/serverRenderPlugin';

export default function createPlugin(): ServerPlugin {
  return {
    name: 'plugin-routing',
    decorateApp(ctx, app) {
      return function LazyWrapper() {
        return createElement(
          StaticRouter,
          { location: ctx.request.path },
          createElement(app)
        );
      };
    },
  };
}
