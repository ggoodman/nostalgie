///<reference types="vite/client" />

import React from 'react';
import { invariant } from '../../../../invariant';
import { LazyContext } from './context';

export function createLazy<TComponent extends React.ComponentType<any>>(
  factory: () => Promise<{ default: TComponent }>
) {
  return function useLazyComponent() {
    const manager = React.useContext(LazyContext);

    invariant(
      manager,
      `Missing nostalgie lazy context. Did you forget to include the lazy plugin?`
    );

    return manager.useLoadState(factory);
  };
}
