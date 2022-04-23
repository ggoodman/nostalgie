import { routingPlugin } from 'nostalgie/plugins/routing';
import { createSettings } from '../../../src/settings';

export default createSettings({
  // This needs to point to the root layout. The plugin will assume
  // that the `routes` folder is adjacent to it.
  appEntrypoint: './root.tsx',
  plugins: [
    routingPlugin({
      routesPath: './routes',
    }),
  ],
});
