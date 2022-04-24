import type { Instance } from 'twind';
import { getStyleTagProperties, VirtualSheet } from 'twind/sheets';
import type { ServerPlugin } from '../../../internal/server/serverRenderPlugin';
import type { TwindPluginOptions } from '../options';
import createBasePlugin from '../server';

export default function twindPlugin(
  options: TwindPluginOptions = {}
): ServerPlugin<{ sheet: VirtualSheet; twind: Instance }> {
  return {
    ...createBasePlugin(),

    renderHtml(ctx, document) {
      const els = Array.from(document.querySelectorAll('[class]'));
      const {
        sheet,
        twind: { tw },
      } = ctx.state;

      // Normalize attribute ordering and shortcut names
      for (const el of els) {
        const mappedClassName = tw(el.className);
        // console.log(el.className, mappedClassName);
        if (mappedClassName) {
          el.setAttribute('class', mappedClassName);
        }
      }

      const stylesheetProps = getStyleTagProperties(sheet);
      // console.log(sheet.target);
      const stylesheetEl = document.createElement('style');
      stylesheetEl.setAttribute('id', stylesheetProps.id);
      stylesheetEl.textContent = stylesheetProps.textContent;
      document.head.appendChild(stylesheetEl);
    },
  };
}
