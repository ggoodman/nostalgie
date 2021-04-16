import type { ServerPlugin } from '../../server/plugin';

export default function createPlugin(options: {}): ServerPlugin {
  return {
    name: 'lazy-plugin',
  };
}
