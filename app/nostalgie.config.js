import { lazyPlugin } from 'nostalgie/plugins/lazy';
import { twindPlugin } from 'nostalgie/plugins/twind';
import { createSettings } from '../src/settings';

export default createSettings({
  appEntrypoint: './src/App.tsx',
  plugins: [lazyPlugin(), twindPlugin()],
});
