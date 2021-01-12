import { QueryObserverResult, useQuery } from 'react-query';
import type {
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
  UseFunctionOptions,
} from './types';

export function useFunctionBrowser<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: UseFunctionOptions
) {
  if (!isFunctionFacade(fn)) {
    throw new Error(
      'Invariant violation: Attempting to invoke a server function not decorated by the Proxy facade'
    );
  }

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
    { ...options, retry: false }
  ) as QueryObserverResult<FunctionReturnType<T>>;
}

async function invokeViaHttp(
  batch: { functionName: string; args: any[] },
  signal?: AbortSignal
): Promise<any[]> {
  const url = new URL(
    process.env.NOSTALGIE_RPC_PATH!,
    process.env.NOSTALGIE_PUBLIC_URL || import.meta.url
  );
  const res = await fetch(url.href, {
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

interface FunctionFacade {
  name: string;
}

function isFunctionFacade(fn: unknown): fn is FunctionFacade {
  return fn && typeof fn === 'object' && (fn as any).name && typeof (fn as any).name === 'string';
}
