import { createElement } from 'react';
import { StaticRouter } from 'react-router-dom/server';
import type { ServerPlugin } from '../../../internal/server';

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