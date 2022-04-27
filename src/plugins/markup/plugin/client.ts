import { createElement } from 'react';
import type { ClientPlugin } from '../../../internal/client/clientRenderPlugin';
import { MarkupContext } from '../context';
import { MarkupLayer, MarkupManager } from '../manager';
import { pluginName } from './plugin';

export default function createPlugin(options: {}): ClientPlugin<
  MarkupLayer,
  { manager: MarkupManager }
> {
  return {
    name: pluginName,
    createState(ctx) {
      return {
        manager: new MarkupManager({ baseLayer: ctx.serverData }),
      };
    },
    decorateApp(ctx, app) {
      return function ClientMarkupProvider() {
        return createElement(
          MarkupContext.Provider,
          { value: ctx.state.manager },
          createElement(app)
        );
      };
    },
  };
}
