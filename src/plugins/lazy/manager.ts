import * as React from 'react';
import { invariant } from '../../invariant';
import { getFactoryMeta, LazyFactoryMetadata } from './factory';
import type { Idle, Loading, LoadState, Rejected, Resolved } from './state';

export class LazyManager {
  private readonly loadStateById: Map<string, LoadState> = new Map();

  preload<TComponent extends React.ComponentType<any>>(
    id: string,
    factory: () => Promise<{ default: TComponent }>
  ): Promise<unknown> | undefined {
    const { key, loadState, map } = this.ensureKnownChunkRegistered(factory, {
      id,
    });

    return this.load(factory, key, map, loadState);
  }

  /**
   * Ensure that the factory is already registered without actually starting any loading.
   */
  ensureRegistered<TComponent extends React.ComponentType<any>>(
    factory: () => Promise<{ default: TComponent }>
  ): {
    loadState: LoadState<TComponent>;
    key: unknown;
    map: { set(key: unknown, loadState: LoadState): unknown };
  } {
    const meta = getFactoryMeta(factory);

    invariant(meta, 'Lazy component is not recognized');

    return this.ensureKnownChunkRegistered(factory, meta);
  }

  private ensureKnownChunkRegistered<
    TComponent extends React.ComponentType<any>
  >(
    factory: () => Promise<{ default: TComponent }>,
    meta: LazyFactoryMetadata
  ): {
    loadState: LoadState<TComponent>;
    key: unknown;
    map: { set(key: unknown, loadState: LoadState): unknown };
  } {
    const trackedLoadState = this.loadStateById.get(meta.id);

    if (trackedLoadState) {
      return {
        key: meta.id,
        loadState: trackedLoadState as LoadState<TComponent>,
        map: this.loadStateById,
      };
    }

    if (meta.sync) {
      // The same logic that sets a truthy falue to `meta.sync` will replace dynamic `import()`
      // expressions with synchronous `require()` expressions at build time allowing us to treat
      // the component as synchronous during SSR. However, that doesn't mix super well with
      // a strict type system so we need to do a dangerous cast through unknown.
      const factoryReturn = factory() as unknown as {
        default: TComponent;
      };

      const { default: component } = factoryReturn;
      const loadState: Resolved<TComponent> = {
        status: 'success',
        component,
        isError: false,
        isIdle: false,
        isLoading: false,
        isSuccess: true,
        url: meta.id,
      };

      this.loadStateById.set(meta.id, loadState);

      return {
        key: meta.id,
        loadState,
        map: this.loadStateById,
      };
    }

    const loadState: Idle<TComponent> = {
      status: 'idle',
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      factory,
      url: meta.id,
    };

    this.loadStateById.set(meta.id, loadState);

    return {
      key: meta.id,
      loadState,
      map: this.loadStateById,
    };
  }

  getPreloads(): string[] {
    const preloads: string[] = [];
    for (const [id, state] of this.loadStateById) {
      if (state.isSuccess) {
        preloads.push(id);
      }
    }
    return preloads;
  }

  useLoadState<TComponent extends React.ComponentType<any>>(
    factory: () => Promise<{ default: TComponent }>
  ): LoadState {
    const {
      key,
      loadState: initialLoadState,
      map,
    } = React.useMemo(() => this.ensureRegistered(factory), []);
    const [loadState, setLoadState] = React.useState(initialLoadState);
    const [disposed, setDisposed] = React.useState(false);

    React.useEffect(() => {
      if (!loadState.isIdle) {
        return;
      }

      this.load(factory, key, map, initialLoadState, (loadState) => {
        if (!disposed) {
          setLoadState(loadState);
        }
      });
      return () => setDisposed(true);
    }, [factory, loadState]);

    return loadState;
  }

  private load<TComponent extends React.ComponentType<any>>(
    factory: () => Promise<{ default: TComponent }>,
    key: unknown,
    map: { set(key: unknown, loadState: LoadState): unknown },
    loadState: LoadState<TComponent>,
    onStateChange?: (loadState: LoadState<TComponent>) => void
  ): Promise<unknown> | undefined {
    let promise: Promise<{ default: TComponent }> | undefined;
    let disposed = false;

    const url = loadState.url;

    if (loadState.status === 'idle') {
      promise = factory();
      const loadingState: Loading<TComponent> = {
        status: 'loading',
        isError: false,
        isIdle: false,
        isLoading: true,
        isSuccess: false,
        promise,
        url,
      };

      map.set(key, loadingState);
      if (!disposed) {
        onStateChange?.(loadingState);
      }
    } else if (loadState.status === 'loading') {
      promise = loadState.promise;
    }

    if (promise) {
      promise.then(
        ({ default: component }) => {
          const loadState: Resolved<TComponent> = {
            status: 'success',
            component,
            isError: false,
            isIdle: false,
            isLoading: false,
            isSuccess: true,
            url,
          };
          map.set(key, loadState);
          if (!disposed) {
            onStateChange?.(loadState);
          }
        },
        (error) => {
          const loadState: Rejected = {
            status: 'error',
            error,
            isError: true,
            isIdle: false,
            isLoading: false,
            isSuccess: false,
            url,
          };
          map.set(key, loadState);
          if (!disposed) {
            onStateChange?.(loadState);
          }
        }
      );
    }

    return promise;
  }
}
