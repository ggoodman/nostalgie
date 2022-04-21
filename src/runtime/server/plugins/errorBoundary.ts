import { createElement, Fragment, Suspense } from 'react';
import type { ServerPlugin } from '../plugin';

export function errorBoundaryPlugin(): ServerPlugin {
  return {
    name: 'nostalgie-plugin-error-boundary',
    decorateApp(ctx, app) {
      if (import.meta.env.DEV) {
        app = function DevErrorBoundary() {
          return createElement(
            Suspense,
            { fallback: createElement(Fallback) },
            createElement(app)
          );
        };
      }

      return app;
    },
  };
}

function Fallback() {
  return createElement(Fragment);
}
