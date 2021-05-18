import * as React from 'react';
import type { ClientPlugin } from '../../client/plugin';
import { LazyContext } from './runtime/context';
import { LazyManager } from './runtime/manager';

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

        for (const chunkId of ctx.serverData) {
          const promise = ctx.state.preload(chunkId, () => i(chunkId));

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
