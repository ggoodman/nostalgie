import { createElement } from 'react';
import type { ServerPlugin } from '../../server/plugin';
import { LazyContext } from './runtime/context';
import { LazyManager } from './runtime/manager';

export default function createPlugin(options: {}): ServerPlugin<{
  manager: LazyManager;
}> {
  function stripLeadingSlash(assetId: string): string {
    if (assetId.startsWith('/')) {
      return assetId.slice(1);
    }

    return assetId;
  }

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

      return manager
        .getPreloads()
        .map((srcPath) => [
          srcPath,
          maybeDecorateNonJsPath(
            ctx.assetManifest.translatePath(stripLeadingSlash(srcPath))
          ),
        ]);
    },
    async renderHtml(ctx, document) {
      const manager = ctx.state.manager;
      const preloads = manager.getPreloads();

      for (const srcPath of preloads) {
        const preloadLink = document.createElement('link');
        preloadLink.setAttribute('rel', 'modulepreload');
        preloadLink.setAttribute(
          'href',
          maybeDecorateNonJsPath(
            ctx.assetManifest.translatePath(stripLeadingSlash(srcPath))
          )
        );

        document.head.prepend(preloadLink);
      }
    },
  };
}

/**
 *
 *
 * @see https://github.com/vitejs/vite/blob/e5729bee1e3f0753dc3514757fa15e5533c387fe/packages/vite/src/node/plugins/importAnalysis.ts#L67-L69
 * @param path
 * @returns
 */
function maybeDecorateNonJsPath(path: string): string {
  if (!/\.(jsx?|tsx?|css)$/.test(path)) {
    return `${path}?import`;
  }

  return path;
}
