import * as React from 'react';

export interface ChunkManager {
  readonly chunks: { chunk: string; lazyImport: string }[];
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

export interface LazyFactoryMeta {
  chunk?: string;
  lazyImport?: string;
  sync?: true;
}

interface LazyFactory<T extends React.ComponentType<any>> extends LazyFactoryMeta {
  (): Promise<{ default: T }>;
}

// const ARBITRARY_LAZY_TIMEOUT = 3000;

export function createLazy(realReact: typeof React) {
  return function lazy<T extends React.ComponentType<any>>(factory: LazyFactory<T>) {
    const lazyImport = factory.lazyImport;

    if (!lazyImport) {
      return realReact.lazy(factory);
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

    //   return class LazyComponent<P extends {}> extends React.Component<P, LazyComponentState> {
    //     static contextType = LazyContext;

    //     readonly context!: React.ContextType<typeof LazyContext>;

    //     constructor(props: P) {
    //       super(props);

    //       const chunkManager = this.context;

    //       this.state = chunkManager?.lazyComponentState.get(lazyImport!) || this.loadLazyComponent();
    //     }

    //     loadLazyComponent(): LazyComponentState {
    //       const loadingPromise = resolvedPromise.then(factory).then(
    //         (mod) => {
    //           this.setState({
    //             state: 'loaded',
    //             component: exportedComponent(mod),
    //           });
    //         },
    //         (error) => {
    //           this.setState({
    //             state: 'error',
    //             error,
    //           });
    //         }
    //       );

    //       return {
    //         state: 'loading',
    //         loadingPromise,
    //       };
    //     }

    //     render() {
    //       switch (this.state.state) {
    //         case 'loading':
    //           return realReact.Fragment;
    //         case 'error':
    //           throw this.state.error;
    //         case 'loaded':
    //           debugger;
    //           return realReact.createElement(this.state.component, {
    //             ...this.props,
    //           } as any);
    //         default:
    //           throw new Error(
    //             `Invariant error: impossible lazy component state ${(this.state as any).state}`
    //           );
    //       }
    //     }
    //   };
  };
}

function exportedComponent(mod: any) {
  return Object.hasOwnProperty.call(mod, 'default') ? (mod as any).default : mod;
}

export function register(
  chunkManager: ChunkManager,
  chunk: string | undefined,
  lazyImport: string,
  mod: any
) {
  const component = exportedComponent(mod);
  const lazyComponentState: LazyComponentState = {
    state: 'loaded',
    component,
  };

  if (process.env.NOSTALGIE_BUILD_TARGET === 'server') {
    if (chunk) {
      chunkManager.chunks.push({ chunk, lazyImport });
    }
  }

  chunkManager.lazyComponentState.set(lazyImport, lazyComponentState);

  return lazyComponentState;
}
