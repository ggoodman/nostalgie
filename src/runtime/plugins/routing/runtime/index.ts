import type { ComponentType } from 'react';
import {
  createContext,
  createElement,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { LoadState, Resolved } from '../../lazy/runtime/state';

export { Link } from 'react-router-dom';

export interface RouteLoadState {
  status: LoadState['status'];
  setStatus: (status: LoadState['status']) => void;
}

const RouteBoundaryContext = createContext<RouteLoadState | null>(null);

export function createRoute(useLazy: () => LoadState): ReactElement {
  function LazyRoute(): ReactElement {
    const loadState = useLazy();
    const boundary = useContext(RouteBoundaryContext);

    useEffect(() => {
      if (boundary) {
        boundary.setStatus(loadState.status);
      }
    });

    switch (loadState.status) {
      case 'error':
        throw loadState.error;
      case 'idle':
        return createElement('div', null, 'Idle');
      case 'loading':
        return createElement('div', null, 'Loading...');
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

  return createElement(LazyRoute);
}

function RouteBoundary(props: { loadState: Resolved<ComponentType<any>> }) {
  const [status, setStatus] = useState<LoadState['status']>(
    () => props.loadState.status
  );

  return createElement(
    RouteBoundaryContext.Provider,
    {
      value: {
        status,
        setStatus,
      },
    },
    null,
    createElement(props.loadState.component)
  );
}
