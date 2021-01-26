import type { AbortSignal } from 'abort-controller';
import type { UseMutationOptions, UseQueryOptions } from 'react-query';
import type { ServerAuth } from '../auth/server';

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
  auth: ServerAuth;
  signal?: AbortSignal;
}

export interface ServerFunction {
  (ctx: ServerFunctionContext, ...args: any[]): any;
}
