import { routingPlugin } from 'nostalgie/routing/plugin';
import { defineConfig } from '../../../src/config';

export default defineConfig({
  // This needs to point to the root layout. The plugin will assume
  // that the `routes` folder is adjacent to it.
  appEntrypoint: './root.tsx',
  plugins: [
    routingPlugin({
      routesPath: './routes',
    }),
  ],
});
