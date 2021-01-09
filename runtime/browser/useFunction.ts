// import DataLoader from 'dataloader';
import { QueryObserverResult, useQuery, UseQueryOptions } from 'react-query';

export interface ServerFunctionContext {
  user: unknown;
}

export interface ServerFunction {
  (ctx: ServerFunctionContext, ...args: any[]): any;
}

export interface UseFunctionOptions extends Omit<UseQueryOptions, 'queryFn'> {}

type NonContextFunctionArgs<T extends ServerFunction> = T extends (
  ctx: ServerFunctionContext,
  ...args: infer U
) => any
  ? U
  : never;

type FunctionReturnType<T extends ServerFunction> = ReturnType<T> extends PromiseLike<infer U>
  ? U
  : ReturnType<T>;

export function useFunction<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: UseFunctionOptions
) {
  if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
    if (!isFunctionFacade(fn)) {
      throw new Error(
        'Invariant violation: Attempting to invoke a server function not decorated by the Proxy facade'
      );
    }

    // const loader = React.useRef(
    //   new DataLoader(batchFetch, {
    //     batchScheduleFn: (callback) => queueMicrotask(callback),
    //     cache: false,
    //   })
    // );

    return useQuery(
      [fn.name, [...args]],
      (ctx) => {
        return batchFetch({ functionName: ctx.queryKey[0], args: ctx.queryKey[1] });
      },
      { ...options, retry: false }
    ) as QueryObserverResult<FunctionReturnType<T>>;
  }

  return useQuery(
    [fn.name, [...args]],
    () => {
      return fn({ user: undefined }, ...args) as Promise<FunctionReturnType<T>>;
    },
    { ...options, retry: false }
  ) as QueryObserverResult<FunctionReturnType<T>>;
}

async function batchFetch(batch: { functionName: string; args: any[] }): Promise<any[]> {
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
