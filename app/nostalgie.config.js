import { lazyPlugin } from 'nostalgie/plugins/lazy';
import { routingPlugin } from 'nostalgie/plugins/routing';
import { twindPlugin } from 'nostalgie/plugins/twind';
import { createSettings } from '../src/settings';

export default createSettings({
  appEntrypoint: './src/root',
  plugins: [
    routingPlugin({
      routesPath: './src/routes',
    }),
    lazyPlugin(),
    twindPlugin({ shimHtml: false }),
  ],
});
