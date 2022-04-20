import * as React from 'react';
import { BrowserRouter } from 'react-router-dom';
import type { ClientPlugin } from '../../client/plugin';

export default function createPlugin(): ClientPlugin {
  return {
    name: 'plugin-routing',
    decorateApp(ctx, app) {
      return function LazyWrapper() {
        return React.createElement(
          BrowserRouter,
          null,
          React.createElement(app)
        );
      };
    },
  };
}
