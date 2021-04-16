import type { ClientPlugin } from '../../client/plugin';

export default function createPlugin(options: {}): ClientPlugin {
  return {
    name: 'lazy-plugin',
  };
}
