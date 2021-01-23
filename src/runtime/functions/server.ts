///<reference types="node" />

import { AbortController } from 'abort-controller';
import * as React from 'react';
import { QueryClient, QueryClientProvider, QueryObserverResult, useQuery } from 'react-query';
import { invariant } from '../../invariant';
import type { ServerAuth } from '../auth/server';
import type {
  FunctionMutationOptions,
  FunctionQueryOptions,
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
} from './types';

export const ServerQueryContext = React.createContext<ServerQueryExecutor | undefined>(undefined);

export interface ServerQueryExecutor {
  readonly queryClient: QueryClient;
  readonly promises: Set<Promise<unknown>>;

  executeQuery<T extends ServerFunction>(
    fn: T,
    args: NonContextFunctionArgs<T>,
    options?: FunctionQueryOptions
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

export interface ServerQueryExecutorImplOptions {
  auth: ServerAuth;
  queryClient: QueryClient;
}

export class ServerQueryExecutorImpl implements ServerQueryExecutor {
  readonly auth: ServerAuth;
  readonly promises = new Set<Promise<unknown>>();
  readonly queryClient: QueryClient;

  constructor(options: ServerQueryExecutorImplOptions) {
    this.auth = options.auth;
    this.queryClient = options.queryClient;
  }

  executeQuery<T extends ServerFunction>(
    fn: T,
    args: NonContextFunctionArgs<T>,
    options?: FunctionQueryOptions
  ) {
    const queryKey = [fn.name, args];
    const state = this.queryClient.getQueryState(queryKey);
    const queryFn = () => {
      const abortController = new AbortController() as import('abort-controller').AbortController;
      const resultPromise = fn(
        { signal: abortController.signal, auth: this.auth },
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

export function createFunctionQueryServer<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionQueryOptions = {}
) {
  return function useFunctionQuery(
    args: NonContextFunctionArgs<T>,
    options?: FunctionQueryOptions
  ) {
    const serverQueryExecutor = React.useContext(ServerQueryContext);

    if (!serverQueryExecutor) {
      throw new Error(
        `Invariant violation: the useFunction hook must be called within a ServerQueryContext`
      );
    }

    return serverQueryExecutor.executeQuery(fn, args, {
      ...factoryOptions,
      ...options,
      retry: false,
    }) as QueryObserverResult<FunctionReturnType<T>>;
  };
}

export function createFunctionMutationServer<T extends ServerFunction>(
  _fn: T,
  _factoryOptions: FunctionMutationOptions<
    FunctionReturnType<T>,
    unknown,
    NonContextFunctionArgs<T>
  > = {}
) {
  return function useFunctionMutation(
    _options: FunctionMutationOptions<
      FunctionReturnType<T>,
      unknown,
      NonContextFunctionArgs<T>
    > = {}
  ) {
    invariant(
      true,
      `The "mutate" method of observers returned by mutation hooks must not be invoked on the server`
    );
  };
}

export function useFunctionServer<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: FunctionQueryOptions
) {
  const serverQueryExecutor = React.useContext(ServerQueryContext);

  if (!serverQueryExecutor) {
    throw new Error(
      `Invariant violation: the useFunction hook must be called within a ServerQueryContext`
    );
  }

  return serverQueryExecutor.executeQuery(fn, args, options) as QueryObserverResult<
    FunctionReturnType<T>
  >;
}
