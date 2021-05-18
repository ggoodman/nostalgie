import { createElement } from 'react';
import type { ServerPlugin } from '../../server/plugin';
import { LazyContext } from './runtime/context';
import { LazyManager } from './runtime/manager';

export default function createPlugin(options: {}): ServerPlugin<{
  manager: LazyManager;
}> {
  return {
    name: 'lazy-plugin',
    createState() {
      return {
        manager: new LazyManager(),
      };
    },
    decorateApp(ctx, app) {
      return function LazyWrapper() {
        return createElement(
          LazyContext.Provider,
          { value: ctx.state.manager },
          createElement(app)
        );
      };
    },
    getClientBootstrapData(ctx) {
      const manager = ctx.state.manager;

      return manager.getPreloads();
    },
    renderHtml(ctx, document) {
      const manager = ctx.state.manager;
      const preloads = manager.getPreloads();

      for (const chunkId of preloads) {
        const preloadLink = document.createElement('link');
        preloadLink.setAttribute('rel', 'modulepreload');
        preloadLink.setAttribute('href', chunkId);

        document.head.prepend(preloadLink);
      }
    },
  };
}
