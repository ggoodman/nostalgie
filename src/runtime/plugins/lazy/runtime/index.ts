///<reference types="vite/client" />

import React from 'react';
import { LazyContext } from './context';

export function createLazy<TComponent extends React.ComponentType<any>>(
  factory: () => Promise<{ default: TComponent }>
) {
  return function useLazyComponent() {
    const manager = React.useContext(LazyContext);

    return manager.useLoadState(factory);
  };
}
