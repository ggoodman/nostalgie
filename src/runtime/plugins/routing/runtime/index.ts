import type { ReactElement } from 'react';
import * as React from 'react';
import type { LoadState } from '../../lazy/runtime/state';

export { Link } from 'react-router-dom';

export function createRoute(useLazy: () => LoadState): ReactElement {
  function LazyRoute(): ReactElement {
    const loadState = useLazy();

    switch (loadState.status) {
      case 'error':
        throw loadState.error;
      case 'idle':
        return React.createElement('div', null, 'Idle');
      case 'loading':
        return React.createElement('div', null, 'Loading...');
      case 'success':
        if (import.meta.env.DEV) {
          if (loadState.component == null) {
            console.warn(
              `A route referred to a lazy component at ${loadState.url} that has no default export. Did you forget to export your route or layout component?`
            );
          }
        }
        return React.createElement(loadState.component);
    }
  }

  return React.createElement(LazyRoute);
}
