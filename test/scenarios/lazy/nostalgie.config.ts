import { lazyPlugin } from 'nostalgie/lazy/plugin';
import { defineConfig } from '../../../src/config';

export default defineConfig({
  appEntrypoint: './',
  plugins: [lazyPlugin()],
});
