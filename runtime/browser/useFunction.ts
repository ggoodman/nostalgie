import { useQuery, UseQueryOptions } from 'react-query';

export interface ServerFunctionContext {
  user: unknown;
}

export interface ServerFunction {
  (ctx: ServerFunctionContext, ...args: any[]): any;
}

export interface UseFunctionOptions extends UseQueryOptions {}

type NonContextFunctionArgs<T extends ServerFunction> = T extends (
  ctx: ServerFunctionContext,
  ...args: infer U
) => any
  ? U
  : never;

type FunctionReturnType<T extends ServerFunction> = ReturnType<T> extends PromiseLike<infer U>
  ? U
  : ReturnType<T>;

function useFunctionWithOptions<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options: UseFunctionOptions = {}
) {
  if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
    if (!isFunctionFacade(fn)) {
      throw new Error(
        'Invariant violation: Attempting to invoke a server function not decorated by the Proxy facade'
      );
    }

    return useQuery(
      [fn.name, [...args]],
      async (ctx) => {
        const url = new URL(
          process.env.NOSTALGIE_RPC_PATH!,
          process.env.NOSTALGIE_PUBLIC_URL || import.meta.url
        );
        const res = await fetch(url.href, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ functionName: ctx.queryKey[0], args: ctx.queryKey[1] }),
        });

        if (!res.ok) {
          // TODO: This is a crappy experience. We should have an error protocol.
          throw new Error(`Request failed`);
        }

        return res.json() as Promise<FunctionReturnType<T>>;
      },
      { ...options, retry: false }
    );
  }

  return useQuery(
    [fn.name, [...args]],
    () => {
      return fn({ user: undefined }, ...args);
    },
    { ...options, retry: false, suspense: true }
  );
}

export function useFunction<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: UseFunctionOptions
) {
  return useFunctionWithOptions(fn, args, options);
}

interface FunctionFacade {
  name: string;
}

function isFunctionFacade(fn: unknown): fn is FunctionFacade {
  return fn && typeof fn === 'object' && (fn as any).name && typeof (fn as any).name === 'string';
}
