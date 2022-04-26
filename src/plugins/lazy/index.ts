///<reference types="vite/client" />

import React from 'react';
import { invariant } from '../../invariant';
import { LazyContext } from './context';
import type { LazyOptions } from './manager';
import type { LoadState } from './state';

export function createLazy<T, K extends keyof T | undefined = undefined>(
  factory: () => Promise<T>,
  options?: LazyOptions<T, K>
) {
  return function useLazyComponent(): LoadState<K extends keyof T ? T[K] : T> {
    const manager = React.useContext(LazyContext);

    invariant(
      manager,
      `Missing nostalgie lazy context. Did you forget to include the lazy plugin?`
    );

    return manager.useLoadState(factory, options);
  };
}
