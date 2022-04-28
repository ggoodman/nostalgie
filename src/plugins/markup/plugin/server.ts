import { createElement } from 'react';
import type { ServerPlugin } from '../../../internal/server';
import { MarkupContext } from '../context';
import { extractMarkupOptionsFromDocument } from '../extract';
import { MarkupManager } from '../manager';
import type { MarkupOptions } from '../options';
import { pluginName } from './plugin';

export default function createPlugin(): ServerPlugin<{
  baseLayer?: MarkupOptions;
  manager: MarkupManager;
}> {
  return {
    name: pluginName,
    createState() {
      return {
        manager: new MarkupManager(),
      };
    },
    decorateApp(ctx, app) {
      return function ServerMarkupProvider() {
        return createElement(
          MarkupContext.Provider,
          { value: ctx.state.manager },
          createElement(app)
        );
      };
    },
    renderHtml(ctx, document) {
      ctx.state.baseLayer = extractMarkupOptionsFromDocument(document);

      // We need to use the base layer so that we don't reconcile away
      // anything already encoded in the index.html template.
      ctx.state.manager.render(document, { baseLayer: ctx.state.baseLayer });
    },
    getClientBootstrapData(ctx) {
      return ctx.state.baseLayer;
    },
  };
}
