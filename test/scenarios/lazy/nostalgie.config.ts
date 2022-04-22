import { lazyPlugin } from 'nostalgie/plugins/lazy';
import { createSettings } from '../../../src/settings';

export default createSettings({
  appEntrypoint: './',
  plugins: [lazyPlugin()],
});
