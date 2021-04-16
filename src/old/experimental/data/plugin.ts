import * as React from 'react';
import { QueryCache, QueryClient } from 'react-query';
import * as ReactQueryHydration from 'react-query/hydration';
import type { ServerPlugin } from '../serverPlugin';

export function dataPlugin(cache?: QueryCache): ServerPlugin<{ client: QueryClient }> {
  return {
    name: 'dataPlugin',
    createState: () => {
      const client = new QueryClient({
        queryCache: cache,
        defaultOptions: {
          queries: {
            staleTime: Infinity,
          },
        },
      });

      return {
        client,
      };
    },
    decorateApp(ctx, app) {
      const state = ReactQueryHydration.dehydrate(ctx.state.client);

      return () =>
        React.createElement(ReactQueryHydration.Hydrate, { state }, React.createElement(app));
    },
    cancelPendingOperations(ctx) {
      return ctx.state.client.cancelQueries();
    },
    // TODO: How will I allow Plugins to tweak the generated HTML markup?
  };
}
