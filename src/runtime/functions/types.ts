import type { AbortSignal } from 'abort-controller';
import type { UseMutationOptions, UseQueryOptions } from 'react-query';

export interface FunctionQueryOptions extends Omit<UseQueryOptions, 'queryFn'> {}

export interface FunctionMutationOptions<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> extends UseMutationOptions<TData, TError, TVariables, TContext> {}

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

export interface ServerFunctionContext {
  signal?: AbortSignal;
  user?: unknown;
}

export interface ServerFunction {
  (ctx: ServerFunctionContext, ...args: any[]): any;
}
