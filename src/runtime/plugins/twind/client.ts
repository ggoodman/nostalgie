import { createElement } from 'react';
import { setup, silent, tw } from 'twind';
import type { ClientPlugin } from '../../client/plugin';
import type { TwindPluginOptions } from './options';
import { TwindContext } from './runtime/context';

export default function createPlugin(
  options: TwindPluginOptions = {}
): ClientPlugin {
  return {
    name: 'twind-plugin',
    onBeforeRender() {
      setup({
        mode: silent,
        ...options.twindConfig,
      });
    },
    decorateApp(ctx, app) {
      return function TwindWrapper() {
        return createElement(
          TwindContext.Provider,
          { value: tw },
          createElement(app)
        );
      };
    },
  };
}
