import * as React from 'react';
import type { ClientPlugin } from '../../../internal/client/clientRenderPlugin';
import { LazyContext } from '../context';
import { LazyManager } from '../manager';

export default function createPlugin(options: {}): ClientPlugin<
  string[],
  LazyManager
> {
  return {
    name: 'lazy-plugin',
    createState() {
      return new LazyManager();
    },
    decorateApp(ctx, app) {
      return function LazyWrapper() {
        return React.createElement(
          LazyContext.Provider,
          { value: ctx.state },
          React.createElement(app)
        );
      };
    },
    onBeforeRender(ctx) {
      // TODO: Get rid of this hack, pending https://github.com/evanw/esbuild/issues/1281
      // Create an aliased function that will call dynamic import at runtime but won't be recognized
      // as such at build time.
      const i = new Function('spec', 'return im' + 'port(spec)');
      if (Array.isArray(ctx.serverData) && ctx.serverData.length) {
        const promises: Promise<unknown>[] = [];

        for (const [srcPath, assetUrl] of ctx.serverData) {
          const factory = () => i(assetUrl);
          const promise = ctx.state.preload(
            Object.defineProperty(factory, Symbol.for('nostalgie.id'), {
              configurable: true,
              value: { id: srcPath },
            })
          );

          if (promise) {
            promises.push(promise);
          }
        }

        if (promises.length) {
          return Promise.all(promises);
        }
      }
    },
  };
}