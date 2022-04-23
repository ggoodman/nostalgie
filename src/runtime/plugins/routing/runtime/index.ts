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
import { invariant } from '../../../../invariant';
import type { LoadState, Resolved } from '../../lazy/runtime/state';

export { Link } from 'react-router-dom';

export interface RouteLoadState {
  loadState: LoadState;
  setLoadState: (loadState: LoadState) => void;
}

const RouteBoundaryContext = createContext<RouteLoadState | null>(null);

export function createRoute(useLazy: () => LoadState): ReactElement {
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
          if (loadState.component == null) {
            console.warn(
              `A route referred to a lazy component at ${loadState.url} that has no default export. Did you forget to export your route or layout component?`
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

function RouteBoundary(props: { loadState: Resolved<ComponentType<any>> }) {
  const [loadState, setLoadState] = useState<LoadState>(() => props.loadState);

  return createElement(
    RouteBoundaryContext.Provider,
    {
      value: {
        loadState,
        setLoadState,
      },
    },
    null,
    createElement(props.loadState.component)
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

export function useChildLoadState(): LoadState {
  const ctx = useContext(RouteBoundaryContext);

  invariant(
    ctx,
    'The useChildLoadState hook is being used outside the context of a RouteBoundary.'
  );

  return ctx.loadState;
}
