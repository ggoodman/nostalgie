import { Configuration, setup, silent } from 'twind/shim';
import type { ClientPlugin } from '../clientPlugin';

export default function createPlugin(options: Configuration): ClientPlugin {
  return {
    name: 'twind-plugin',
    onBeforeRender(ctx) {
      setup({
        ...options,
        mode: silent,
        target: ctx.rootElement,
      });
    },
  };
}
