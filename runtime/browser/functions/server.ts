import { AbortController } from 'abort-controller';
import * as React from 'react';
import { QueryClient, QueryClientProvider, QueryObserverResult, useQuery } from 'react-query';
import type {
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
  UseFunctionOptions,
} from './types';

export const ServerQueryContext = React.createContext<ServerQueryExecutor | undefined>(undefined);

export interface ServerQueryExecutor {
  readonly queryClient: QueryClient;
  readonly promises: Set<Promise<unknown>>;

  execute<T extends ServerFunction>(
    fn: T,
    args: NonContextFunctionArgs<T>,
    options?: UseFunctionOptions
  ): QueryObserverResult<unknown>;
}

export function ServerQueryContextProvider(
  props: React.PropsWithChildren<{ queryExecutor: ServerQueryExecutor }>
) {
  return React.createElement(
    QueryClientProvider,
    { client: props.queryExecutor.queryClient },
    React.createElement(ServerQueryContext.Provider, { value: props.queryExecutor }, props.children)
  );
}

export class ServerQueryExecutorImpl implements ServerQueryExecutor {
  readonly promises = new Set<Promise<unknown>>();

  constructor(readonly queryClient: QueryClient) {}

  execute<T extends ServerFunction>(
    fn: T,
    args: NonContextFunctionArgs<T>,
    options?: UseFunctionOptions
  ) {
    const queryKey = [fn.name, args];
    const state = this.queryClient.getQueryState(queryKey);
    const queryFn = () => {
      const abortController = new AbortController() as import('abort-controller').AbortController;
      const resultPromise = fn(
        { signal: abortController.signal, user: undefined },
        ...args
      ) as Promise<FunctionReturnType<T>>;

      return Object.assign(resultPromise, {
        cancel() {
          abortController.abort();
        },
      });
    };

    if (!state) {
      const promise = this.queryClient.prefetchQuery(queryKey, queryFn, options);

      this.promises.add(promise);
      promise.finally(() => this.promises.delete(promise));
    }

    return useQuery(queryKey, queryFn, { ...options, suspense: false });
  }
}

export function useFunctionServer<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: UseFunctionOptions
) {
  const serverQueryExecutor = React.useContext(ServerQueryContext);

  if (!serverQueryExecutor) {
    throw new Error(
      `Invariant violation: the useFunction hook must be called within a ServerQueryContext`
    );
  }

  return serverQueryExecutor.execute(fn, args, options) as QueryObserverResult<
    FunctionReturnType<T>
  >;
}
