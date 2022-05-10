import {
  createContext,
  createElement,
  Fragment,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  matchRoutes,
  useLocation,
  useOutlet,
  useParams as useReactRouterParams,
  useRoutes,
  type Location,
  type RouteObject,
} from 'react-router-dom';
import { invariant } from '../../invariant';
import { createLazy } from '../lazy';
import { LazyContext } from '../lazy/context';
import type { LoadState, Resolved } from '../lazy/state';

export { Link } from 'react-router-dom';

const kFactory = Symbol('kFactory');

export function NostalgieRouter({ routes }: { routes: RouteObject[] }) {
  const location = useLocation();
  const manager = useContext(LazyContext);
  const [childLocation, setChildLocation] = useState(location);
  const loadingFactoriesRef = useRef<
    Map<() => Promise<RouteModuleExports>, Promise<RouteModuleExports>>
  >(new Map());
  const [, startTransition] = useTransition();
  const timeoutHandle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transitionTo = (location: Location) => {
    return () => {
      if (timeoutHandle.current) {
        clearTimeout(timeoutHandle.current);
        timeoutHandle.current = null;
      }

      startTransition(() => {
        setChildLocation(location);
      });
    };
  };

  invariant(
    manager,
    `Missing nostalgie lazy context. Did you forget to include the lazy plugin?`
  );

  const onStateChange = useCallback(
    (
      loadingFactories: Map<
        () => Promise<RouteModuleExports>,
        Promise<RouteModuleExports>
      >,
      factory: () => Promise<RouteModuleExports>,
      loadState: LoadState<RouteModuleExports>,
      location: Location
    ) => {
      // Synchronize
      if (loadingFactories !== loadingFactoriesRef.current) {
        return;
      }

      if (loadState.isError || loadState.isSuccess) {
        loadingFactories.delete(factory);
      }

      if (!loadingFactories.size) {
        if (timeoutHandle.current) {
          clearTimeout(timeoutHandle.current);
          timeoutHandle.current = null;
        }

        startTransition(() => {
          setChildLocation(location);
        });
      }
    },
    []
  );

  useEffect(() => {
    const matches = matchRoutes(routes, location);

    if (matches && location.key !== childLocation.key) {
      loadingFactoriesRef.current = new Map();
      const loadingFactories = loadingFactoriesRef.current;

      // Stop watching old loading states
      loadingFactories.clear();

      if (timeoutHandle.current) {
        clearTimeout(timeoutHandle.current);
        timeoutHandle.current = null;
      }

      for (const match of matches) {
        const lazyFactory = extractLoadState(match.route.element);

        if (lazyFactory) {
          const promise = manager.preload(lazyFactory, (loadState) => {
            onStateChange(loadingFactories, lazyFactory, loadState, location);
          });

          if (promise) {
            loadingFactories.set(lazyFactory, promise);
          }
        }
      }

      if (loadingFactories.size) {
        timeoutHandle.current = setTimeout(transitionTo(location), 500);
      } else {
        // If we have no loading factories, no work is needed. Transition immediately
        startTransition(() => {
          setChildLocation(location);
        });
      }
    }
  }, [routes, childLocation.key, location.key]);

  return useRoutes(routes, childLocation);
}

function extractLoadState(
  element: ReactNode | undefined
): (() => Promise<RouteModuleExports>) | undefined {
  return (element as any)?.[kFactory];
}

export interface RouteModuleExports {
  default: ComponentType<any>;
}

export interface RouteLoadState {
  loadState: LoadState<RouteModuleExports>;
  setLoadState: (loadState: LoadState<RouteModuleExports>) => void;
}

const RouteBoundaryContext = createContext<RouteLoadState | null>(null);

export function createRoute(
  factory: () => Promise<RouteModuleExports>
): ReactElement {
  const useLazy = createLazy(factory);

  function LazyRoute(): ReactElement {
    const loadState = useLazy();
    const boundary = useContext(RouteBoundaryContext);
    const outletContext = useContext(NostalgieOutletContext);

    useEffect(() => {
      if (boundary) {
        boundary.setLoadState(loadState);
      }
    }, [boundary, loadState]);

    switch (loadState.status) {
      case 'error':
        throw loadState.error;
      case 'idle':
        // This should never render.
        return createElement(Fragment);
      case 'loading':
        return outletContext?.loadingElement
          ? createElement(Fragment, null, outletContext.loadingElement)
          : createElement(Fragment);
      case 'success':
        if (import.meta.env.DEV) {
          if (typeof loadState.value.default !== 'function') {
            console.warn(
              `A route referred to a lazy component at ${loadState.url} whose default export is not a function. Did you forget to export your route or layout component?`
            );
          }
        }

        return createElement(RouteBoundary, {
          loadState,
        });
    }
  }

  return new Proxy(
    createElement(
      Suspense,
      {
        fallback: createElement(Fragment),
      },
      createElement(
        ErrorBoundary,
        { fallback: createElement(Fragment) },
        createElement(LazyRoute)
      )
    ),
    {
      get(target, p, receiver) {
        if (p === kFactory) {
          return factory;
        }
        return Reflect.get(target, p, receiver);
      },
    }
  );
}

function RouteBoundary(props: { loadState: Resolved<RouteModuleExports> }) {
  const [loadState, setLoadState] = useState<LoadState<RouteModuleExports>>(
    () => props.loadState
  );

  return createElement(
    RouteBoundaryContext.Provider,
    {
      value: {
        loadState,
        setLoadState,
      },
    },
    null,
    createElement(props.loadState.value.default)
  );
}

export interface OutletProps<T extends Record<string, unknown> = {}> {
  context?: T;
  loading?: ReactElement;
}

interface NostalgieOutletState {
  loadingElement?: ReactElement;
}

const NostalgieOutletContext = createContext<NostalgieOutletState | null>(null);

export function Outlet({ loading, context }: OutletProps) {
  const outlet = useOutlet(context);

  return createElement(
    NostalgieOutletContext.Provider,
    {
      value: {
        loadingElement: loading,
      },
    },
    outlet
  );
}

export function useParams() {
  return useReactRouterParams();
}

export function useChildLoadState(): LoadState<RouteModuleExports> {
  const ctx = useContext(RouteBoundaryContext);

  invariant(
    ctx,
    'The useChildLoadState hook is being used outside the context of a RouteBoundary.'
  );

  return ctx.loadState;
}
