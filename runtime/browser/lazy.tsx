import * as React from 'react';

export interface ChunkManager {
  readonly chunks: Map<string, string>;
  readonly lazyComponentState: Map<string, LazyComponentState>;
}

interface LazyComponentStateLoading {
  readonly state: 'loading';
  readonly loadingPromise: Promise<void>;
}

interface LazyComponentStateLoaded {
  readonly state: 'loaded';
  readonly component: Parameters<typeof React.createElement>[0];
}

interface LazyComponentStateError {
  readonly state: 'error';
  readonly error: unknown;
}

type LazyComponentState =
  | LazyComponentStateLoading
  | LazyComponentStateLoaded
  | LazyComponentStateError;

export const LazyContext = React.createContext<ChunkManager | undefined>(undefined);

const resolvedPromise = Promise.resolve();

interface LazyFactory<T extends React.ComponentType<any>> {
  (): Promise<{ default: T }>;
  chunk?: string;
  lazyImport?: string;
}

// const ARBITRARY_LAZY_TIMEOUT = 3000;

export function lazy<T extends React.ComponentType<any>>(
  factory: LazyFactory<T>
): React.LazyExoticComponent<T> | React.FC {
  const lazyImport = factory.lazyImport;

  if (!lazyImport) {
    return React.lazy(factory);
  }

  let loadAheadTimeout: number | undefined = undefined;
  let loadAheadState: LazyComponentState | undefined;

  // if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
  //   loadAheadTimeout = (setTimeout(
  //     () =>
  //       factory().then(
  //         (mod) => {
  //           const component = Object.hasOwnProperty.call(mod, 'default')
  //             ? (mod as any).default
  //             : mod;
  //           loadAheadState = {
  //             state: 'loaded',
  //             component,
  //           };
  //         },
  //         (error) => {
  //           loadAheadState = {
  //             state: 'error',
  //             error,
  //           };
  //         }
  //       ),
  //     ARBITRARY_LAZY_TIMEOUT
  //   ) as unknown) as number;
  // }

  return function LazyComponent<P extends {}>(props: P, ...children: React.ReactChild[]) {
    const chunkManager = React.useContext(LazyContext);

    if (!chunkManager) {
      throw new Error(
        `Invariant violation: The LazyContext.Provider is not a parent component of a lazy component`
      );
    }

    if (loadAheadTimeout) {
      clearTimeout(loadAheadTimeout);
    }

    let lazyComponentState = chunkManager.lazyComponentState.get(lazyImport) || loadAheadState;

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
        throw lazyComponentState.loadingPromise;
      case 'error':
        throw lazyComponentState.error;
      case 'loaded':
        return React.createElement(lazyComponentState.component, props, ...children);
    }
  };
}

export function register(
  chunkManager: ChunkManager,
  chunk: string | undefined,
  lazyImport: string,
  mod: any
) {
  const component = Object.hasOwnProperty.call(mod, 'default') ? (mod as any).default : mod;

  if (process.env.NOSTALGIE_BUILD_TARGET === 'server') {
    if (chunk) {
      if (chunkManager.chunks.has(chunk)) {
        throw new Error('WAT?');
      }

      chunkManager.chunks.set(chunk, lazyImport);
    }
  }

  chunkManager.lazyComponentState.set(lazyImport, {
    state: 'loaded',
    component,
  });
}
