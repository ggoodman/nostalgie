import { setup, silent } from 'twind/shim';
import type { ClientPlugin } from '../../../client/clientRenderPlugin';
import createBasePlugin from '../client';
import type { TwindPluginOptions } from '../options';

export default function createPlugin(
  options: TwindPluginOptions = {}
): ClientPlugin {
  return {
    ...createBasePlugin(options),
    name: 'twind-plugin',
    onBeforeRender(ctx) {
      setup({
        mode: silent,
        ...options.twindConfig,
        target: ctx.rootElement,
      });
    },
  };
}
