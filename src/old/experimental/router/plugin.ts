import * as React from 'react';
import { StaticRouter, StaticRouterProps } from 'react-router-dom/server';
import type { ServerPlugin } from '../serverPlugin';

export function routerPlugin(): ServerPlugin<StaticRouterProps> {
  return {
    name: 'routerPlugin',
    createState: (ctx) => {
      return {
        location: ctx.request.path,
      };
    },
    decorateApp(ctx, app) {
      return () => React.createElement(StaticRouter as any, ctx.state, React.createElement(app));
    },
  };
}
