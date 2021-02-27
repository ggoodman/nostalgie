import * as React from 'react';
import { LazyContext } from './context';
import { register } from './register';
import type { LazyFactory } from './types';

const resolvedPromise = Promise.resolve();

interface LazyOptions<T> {
  fallback?: (props: T extends React.ComponentType<infer U> ? U : unknown) => React.ElementType;
}

export function lazy<T extends React.ComponentType<any>>(
  factory: LazyFactory<T>,
  options: LazyOptions<T>
) {
  const lazyImport = factory.lazyImport;

  if (!lazyImport) {
    return React.lazy(factory);
  }

  return function LazyComponent<P extends {}>(props: P, ...children: React.ReactChild[]) {
    const chunkManager = React.useContext(LazyContext);

    if (!chunkManager) {
      throw new Error(
        `Invariant violation: The LazyContext.Provider is not a parent component of a lazy component`
      );
    }

    let lazyComponentState = chunkManager.lazyComponentState.get(lazyImport);

    if (process.env.NOSTALGIE_BUILD_TARGET === 'server') {
      // Wrap in a condition that will get eliminated by esbuild in the client
      if (factory.sync && !lazyComponentState) {
        // We're rendering server-side so we can expect the factory to return
        // the component *immediately* instead of a `Promise`, like in the client.
        const mod = factory();

        if (typeof mod.then === 'function') {
          throw new Error(
            'Invariant violation: The lazy component server factory produed a Thenable'
          );
        }

        lazyComponentState = register(chunkManager, factory.chunk, lazyImport, mod);
      }
    }

    if (!lazyComponentState) {
      const loadingPromise = resolvedPromise.then(factory).then(
        (mod) => {
          register(chunkManager, factory.chunk, lazyImport, mod);
        },
        (error) => {
          chunkManager.lazyComponentState.set(lazyImport, {
            state: 'error',
            error,
          });

          throw error;
        }
      );

      lazyComponentState = {
        state: 'loading',
        loadingPromise,
      };

      chunkManager.lazyComponentState.set(lazyImport, lazyComponentState);
    }

    switch (lazyComponentState.state) {
      case 'loading':
        if (process.env.NOSTALGIE_BUILD_TARGET === 'server') {
          return React.createElement(React.Fragment);
        }
        throw lazyComponentState.loadingPromise;
      case 'error':
        throw lazyComponentState.error;
      case 'loaded':
        return React.createElement(lazyComponentState.component, props, ...children);
    }
  };
}
