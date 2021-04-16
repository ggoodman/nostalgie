import { Configuration, create, silent } from 'twind';
import { getStyleTagProperties, virtualSheet } from 'twind/sheets';
import type { ServerPlugin } from '../../server/plugin';

export default function twindPlugin(): ServerPlugin {
  const configuration: Configuration = {
    darkMode: 'media',
    preflight: true,
  };

  return {
    name: 'twind-plugin',
    renderHtml(ctx, document) {
      const els = document.querySelectorAll('[class]');
      const sheet = virtualSheet();
      const { tw } = create({
        ...configuration,
        mode: silent,
        sheet,
      });

      for (const el of els) {
        const mappedClassName = tw(el.className);
        // console.log(el.className, mappedClassName);
        if (mappedClassName) {
          el.setAttribute('class', mappedClassName);
        }
      }

      // console.log('renderHtml', els, ctx.state.sheet.target);

      const stylesheetProps = getStyleTagProperties(sheet);
      // console.log(sheet.target);
      const stylesheetEl = document.createElement('style');
      stylesheetEl.setAttribute('id', stylesheetProps.id);
      stylesheetEl.textContent = stylesheetProps.textContent;
      document.head.appendChild(stylesheetEl);
    },
  };
}
