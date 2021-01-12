import { useFunctionBrowser } from './browser';
import { useFunctionServer } from './server';
import type { NonContextFunctionArgs, ServerFunction, UseFunctionOptions } from './types';
export type { ServerFunction, ServerFunctionContext, UseFunctionOptions } from './types';

export function useFunction<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: UseFunctionOptions
) {
  if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
    return useFunctionBrowser(fn, args, options);
  }

  return useFunctionServer(fn, args, options);
}
