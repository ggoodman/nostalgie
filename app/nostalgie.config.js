//@ts-check

import { lazyPlugin } from 'nostalgie/lazy/plugin';
import { markupPlugin } from 'nostalgie/markup/plugin';
import { routingPlugin } from 'nostalgie/routing/plugin';
import { twindPlugin } from 'nostalgie/twind/plugin';
import { defineConfig } from '../src/config';

export default defineConfig({
  appEntrypoint: './src/root.tsx',
  plugins: [
    lazyPlugin(),
    routingPlugin({
      routesPath: './src/routes',
    }),
    twindPlugin({
      shimHtml: false,
      twindConfig: {
        preflight: {
          '@import':
            "url('https://fonts.googleapis.com/css2?family=Monoton&display=swap&text=N')",
        },
      },
    }),
    markupPlugin(),
  ],
});
