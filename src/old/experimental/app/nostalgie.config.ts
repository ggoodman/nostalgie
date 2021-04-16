import { createConfig } from '../config';
import { htmlPlugin } from '../html/plugin';
import { twindPlugin } from '../twind/plugin';

export default createConfig({
  appEntrypoint: './index.tsx',
  plugins: [htmlPlugin(), twindPlugin()],
});
