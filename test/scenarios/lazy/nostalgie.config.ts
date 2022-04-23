import { lazyPlugin } from 'nostalgie/plugins/lazy';
import { defineConfig } from '../../../src/config';

export default defineConfig({
  appEntrypoint: './',
  plugins: [lazyPlugin()],
});
