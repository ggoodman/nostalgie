//@ts-check

import { lazyPlugin } from 'nostalgie/plugins/lazy';
import { routingPlugin } from 'nostalgie/plugins/routing';
import { twindPlugin } from 'nostalgie/plugins/twind';
import { defineConfig } from '../src/config';

export default defineConfig({
  appEntrypoint: './src/root',
  plugins: [
    routingPlugin({
      routesPath: './src/routes',
    }),
    lazyPlugin(),
    twindPlugin({ shimHtml: false }),
  ],
});
