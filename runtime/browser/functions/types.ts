import type { AbortSignal } from 'abort-controller';
import type { UseQueryOptions } from 'react-query';

export interface ServerFunctionContext {
  signal?: AbortSignal;
  user?: unknown;
}

export interface ServerFunction {
  (ctx: ServerFunctionContext, ...args: any[]): any;
}

export interface UseFunctionOptions extends Omit<UseQueryOptions, 'queryFn'> {}

export type NonContextFunctionArgs<T extends ServerFunction> = T extends (
  ctx: ServerFunctionContext,
  ...args: infer U
) => any
  ? U
  : never;

export type FunctionReturnType<T extends ServerFunction> = ReturnType<T> extends PromiseLike<
  infer U
>
  ? U
  : ReturnType<T>;
