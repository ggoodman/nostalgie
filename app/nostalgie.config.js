//@ts-check

import { lazyPlugin } from 'nostalgie/lazy/plugin';
import { routingPlugin } from 'nostalgie/routing/plugin';
import { twindPlugin } from 'nostalgie/twind/plugin';
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
