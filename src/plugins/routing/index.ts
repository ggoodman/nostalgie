import {
  createContext,
  createElement,
  Fragment,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  useOutlet,
  useOutletContext,
  useParams as useReactRouterParams,
} from 'react-router-dom';
import { invariant } from '../../invariant';
import type { LoadState, Resolved } from '../lazy/state';

export { Link } from 'react-router-dom';

export interface RouteModuleExports {
  default: ComponentType<any>;
}

export interface RouteLoadState {
  loadState: LoadState<RouteModuleExports>;
  setLoadState: (loadState: LoadState<RouteModuleExports>) => void;
}

const RouteBoundaryContext = createContext<RouteLoadState | null>(null);

export function createRoute(
  useLazy: () => LoadState<RouteModuleExports>
): ReactElement {
  function LazyRoute(): ReactElement {
    const loadState = useLazy();
    const boundary = useContext(RouteBoundaryContext);
    const outletContext = useOutletContext<{ loading?: ReactElement } | null>();

    useEffect(() => {
      if (boundary) {
        boundary.setLoadState(loadState);
      }
    }, [boundary, loadState]);

    switch (loadState.status) {
      case 'error':
        throw loadState.error;
      case 'idle':
        return createElement(Fragment);
      case 'loading':
        return outletContext?.loading ?? createElement(Fragment);
      case 'success':
        if (import.meta.env.DEV) {
          if (typeof loadState.value.default !== 'function') {
            console.warn(
              `A route referred to a lazy component at ${loadState.url} whose default export is not a function. Did you forget to export your route or layout component?`
            );
          }
        }

        return createElement(RouteBoundary, { loadState });
    }
  }

  return createElement(
    Suspense,
    {
      fallback: createElement(Fragment),
    },
    createElement(
      ErrorBoundary,
      { fallback: createElement(Fragment) },
      createElement(LazyRoute)
    )
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

export function Outlet(props: OutletProps) {
  return useOutlet({
    ...props.context,
    loading: props.loading,
  });
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
