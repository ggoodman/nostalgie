import * as React from 'react';
import { invariant } from '../../invariant';
import { getFactoryMeta } from './factory';
import type { Idle, Loading, LoadState, Rejected, Resolved } from './state';

export interface LazyOptions<
  T = any,
  K extends keyof T | undefined = undefined
> {
  /**
   * The name of the property to expose as the lazy state's `value` property.
   *
   * For example, if you're importing a React component, you might want to grab
   * the `"default"` export when you use code like:
   *
   * ```jsx
   * export default function MyComponent() {
   *   // ...
   * }
   * ```
   */
  name?: K;
}

export class LazyManager {
  private readonly loadStateById: Map<string, LoadState<unknown>> = new Map();

  preload<T>(
    factory: () => Promise<T>,
    onStateChange?: (loadState: LoadState<T>) => void
  ): Promise<T> | undefined {
    return this.load(factory, onStateChange);
  }

  private ensureKnownChunkRegistered<T>(factory: () => Promise<T>): {
    loadState: LoadState<T>;
    key: unknown;
    map: { set(key: unknown, loadState: LoadState<unknown>): unknown };
  } {
    const meta = getFactoryMeta(factory);

    invariant(meta, 'Missing factory metadata for lazy import');

    const key = meta.id;
    const trackedLoadState = this.loadStateById.get(key);

    if (trackedLoadState) {
      return {
        key,
        loadState: trackedLoadState as LoadState<T>,
        map: this.loadStateById,
      };
    }

    if (import.meta.env.SSR) {
      if (meta.sync) {
        // The same logic that sets a truthy falue to `meta.sync` will replace dynamic `import()`
        // expressions with synchronous `require()` expressions at build time allowing us to treat
        // the component as synchronous during SSR. However, that doesn't mix super well with
        // a strict type system so we need to do a dangerous cast through unknown.
        const factoryReturn = factory() as unknown as T;

        const loadState: Resolved<T> = {
          status: 'success',
          value: factoryReturn,
          isError: false,
          isIdle: false,
          isLoading: false,
          isSuccess: true,
          url: meta.id,
        };

        this.loadStateById.set(key, loadState);

        return {
          key,
          loadState,
          map: this.loadStateById,
        };
      }
    }

    const loadState: Idle<T> = {
      status: 'idle',
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      factory,
      url: meta.id,
    };

    this.loadStateById.set(key, loadState);

    return {
      key,
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

  useLoadState<T, K extends keyof T | undefined = undefined>(
    factory: () => Promise<T>,
    options?: LazyOptions<T, K>
  ): LoadState<K extends keyof T ? T[K] : T> {
    const { loadState: initialLoadState } = React.useMemo(
      () => this.ensureKnownChunkRegistered(factory),
      [factory]
    );
    const [, startTransition] = React.useTransition();
    const name = options?.name;
    const [loadState, setLoadState] = React.useState(() =>
      name != null ? mapLoadState(initialLoadState, name!) : initialLoadState
    );
    const [disposed, setDisposed] = React.useState(false);

    React.useEffect(() => {
      // if (!loadState.isIdle) {
      //   return;
      // }

      this.load(factory, (loadState) => {
        // We're not re-mapping the load state for `name` because the initial mapping should result
        // in this getting the mapped state.
        startTransition(() => {
          if (!disposed) {
            setLoadState(loadState);
          }
        });
      });

      return () => setDisposed(true);
    }, [factory, loadState]);

    return loadState as LoadState<K extends keyof T ? T[K] : T>;
  }

  ensureLoading<T>(
    factory: () => Promise<T>,
    onStateChange?: (loadState: LoadState<T>) => void
  ) {
    this.load(factory, onStateChange);
    const { loadState } = this.ensureKnownChunkRegistered(factory);

    return loadState;
  }

  private load<T>(
    factory: () => Promise<T>,
    onStateChange?: (loadState: LoadState<T>) => void
  ): Promise<T> | undefined {
    const { key, loadState, map } = this.ensureKnownChunkRegistered(factory);
    let promise: Promise<T> | undefined;
    let disposed = false;

    const url = loadState.url;

    switch (loadState.status) {
      case 'idle': {
        promise = factory();
        const loadingState: Loading<T> = {
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
          queueMicrotask(() => {
            if (!disposed) {
              onStateChange?.(loadingState);
            }
          });
        }
        break;
      }
      case 'loading': {
        promise = loadState.promise;
        break;
      }
      case 'error':
      case 'success': {
        // Already in a final state. No need to start work so we fire
        // any callback and return immediately.
        if (onStateChange) {
          queueMicrotask(() => onStateChange(loadState));
        }
        return;
      }
    }

    if (promise) {
      promise.then(
        (value) => {
          const loadState: Resolved<T> = {
            status: 'success',
            isError: false,
            isIdle: false,
            isLoading: false,
            isSuccess: true,
            url,
            value,
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

function mapLoadState<T, K extends keyof T>(
  loadState: LoadState<T>,
  name: K
): LoadState<T[K]> {
  switch (loadState.status) {
    case 'idle': {
      return {
        ...loadState,
        factory: () => loadState.factory().then((value) => value[name]),
      };
    }
    case 'loading': {
      return {
        ...loadState,
        promise: loadState.promise.then(),
      };
    }
  }
  if (loadState.status === 'success') {
    return {
      ...loadState,
      value: loadState.value[name],
    };
  }

  return loadState;
}
