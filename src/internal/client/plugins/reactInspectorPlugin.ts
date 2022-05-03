import { createElement } from 'react';
import type { InspectParams } from 'react-dev-inspector';
import { Inspector } from 'react-dev-inspector';
import type { ClientPlugin } from '../clientRenderPlugin';

export function reactInspectorPlugin(): ClientPlugin {
  return {
    name: 'react-inspector-plugin',
    decorateApp(ctx, app) {
      return () =>
        createElement(
          Inspector,
          {
            onClickElement: (inspect: InspectParams) => {
              console.debug(inspect);
            },
          },
          createElement(app)
        );
    },
  };
}
