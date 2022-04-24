import { createElement } from 'react';
import { create, Instance, silent } from 'twind';
import {
  getStyleTagProperties,
  VirtualSheet,
  virtualSheet,
} from 'twind/sheets';
import type { ServerPlugin } from '../../internal/server/serverRenderPlugin';
import type { TwindPluginOptions } from './options';
import { TwindContext } from './runtime/context';

export default function twindPlugin(
  options: TwindPluginOptions = {}
): ServerPlugin<{ sheet: VirtualSheet; twind: Instance }> {
  return {
    name: 'twind-plugin',

    createState() {
      const sheet = virtualSheet();

      return {
        sheet,
        twind: create({
          ...options.twindConfig,
          mode: silent,
          sheet,
        }),
      };
    },

    decorateApp(ctx, app) {
      return function TwindWrapper() {
        return createElement(
          TwindContext.Provider,
          { value: ctx.state.twind.tw },
          createElement(app)
        );
      };
    },

    renderHtml(ctx, document) {
      const sheet = ctx.state.sheet;

      const stylesheetProps = getStyleTagProperties(sheet);
      // console.log(sheet.target);
      const stylesheetEl = document.createElement('style');
      stylesheetEl.setAttribute('id', stylesheetProps.id);
      stylesheetEl.textContent = stylesheetProps.textContent;
      document.head.appendChild(stylesheetEl);
    },
  };
}
