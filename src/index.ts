export type { Plugin } from './plugin';

Object.defineProperty(module, 'exports', {
  get() {
    throw new Error('This module should never be used directly');
  },
});
