import type * as React from 'react';
import type {
  QueryObserverLoadingErrorResult,
  QueryObserverLoadingResult,
  QueryObserverRefetchErrorResult,
  QueryObserverResult,
  QueryObserverSuccessResult,
} from 'react-query';

type SwitchReturn = React.ReactElement;

export interface SwitchComponents<TData> {
  error: (
    query: QueryObserverRefetchErrorResult<TData> | QueryObserverLoadingErrorResult<TData>
  ) => SwitchReturn;
  loading: (query: QueryObserverLoadingResult<TData>) => SwitchReturn;
  success: (query: QueryObserverSuccessResult<TData>) => SwitchReturn;
}

export function switchComponent<TData>(
  query: QueryObserverResult<TData>,
  components: SwitchComponents<TData>
): SwitchReturn {
  switch (query.status) {
    case 'error':
      return components.error(query);
    case 'loading':
      return components.loading(query);
    case 'success':
      return components.success(query);
  }

  throw new Error(`Invariant violation: switchComponent doesn't support idle queries`);
}
