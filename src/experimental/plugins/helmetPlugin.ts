import * as React from 'react';
import * as ReactHelmetAsync from 'react-helmet-async';
import type { Plugin } from '../plugin';

export function helmetPlugin(
  defaultMarkupProps: ReactHelmetAsync.HelmetProps = {}
): Plugin<ReactHelmetAsync.FilledContext> {
  return {
    name: 'helmetPlugin',
    createState: () => {
      return {} as ReactHelmetAsync.FilledContext;
    },
    decorateApp(ctx, app) {
      return () =>
        React.createElement(
          ReactHelmetAsync.HelmetProvider,
          { context: ctx.state },
          React.createElement(ReactHelmetAsync.Helmet, defaultMarkupProps),
          React.createElement(app)
        );
    },
    renderHtml(ctx, document) {
      console.log(ctx.state);
    },
    // TODO: How will I allow Plugins to tweak the generated HTML markup?
  };
}
