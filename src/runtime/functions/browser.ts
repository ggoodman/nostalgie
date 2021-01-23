///<reference lib="dom" />

export * from 'react-query';

import type { AbortSignal } from 'abort-controller';
import { QueryObserverResult, useMutation, useQuery } from 'react-query';
import type {
  FunctionMutationOptions,
  FunctionQueryOptions,
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
} from './types';

export function createFunctionQueryBrowser<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionQueryOptions = {}
) {
  return function useFunctionQuery(
    args: NonContextFunctionArgs<T>,
    options?: FunctionQueryOptions
  ) {
    return useQuery(
      [fn.name, args],
      (ctx) => {
        const abortController = new AbortController() as import('abort-controller').AbortController;
        const resultPromise = invokeViaHttp(
          { functionName: ctx.queryKey[0], args: ctx.queryKey[1] },
          abortController.signal
        );

        return Object.assign(resultPromise, {
          cancel() {
            abortController.abort();
          },
        });
      },
      { ...factoryOptions, ...options, retry: false }
    ) as QueryObserverResult<FunctionReturnType<T>>;
  };
}

export function createFunctionMutationBrowser<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionMutationOptions<
    FunctionReturnType<T>,
    unknown,
    NonContextFunctionArgs<T>
  > = {}
) {
  return function useFunctionMutation(
    options: FunctionMutationOptions<FunctionReturnType<T>, unknown, NonContextFunctionArgs<T>> = {}
  ) {
    return useMutation<FunctionReturnType<T>, unknown, NonContextFunctionArgs<T>>(
      (args) => {
        return invokeViaHttp<FunctionReturnType<T>>({ functionName: fn.name, args });
      },
      {
        ...factoryOptions,
        ...options,
      }
    );
  };
}

async function invokeViaHttp<T = unknown>(
  batch: { functionName: string; args: any[] },
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(process.env.NOSTALGIE_RPC_PATH!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(batch),
    signal,
  });

  if (!res.ok) {
    // TODO: This is a crappy experience. We should have an error protocol.
    throw new Error(`Request failed`);
  }

  return res.json();
}
