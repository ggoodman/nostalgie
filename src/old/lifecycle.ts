import { AbortController, AbortSignal } from 'abort-controller';
import type { Logger } from 'pino';

export function wireAbortController(logger: Logger, options: { signal?: AbortSignal } = {}) {
  const abortController = new AbortController();

  if (options.signal) {
    if (options.signal.aborted) {
      abortController.abort();
    } else {
      options.signal.onabort = () => abortController.abort();
    }
  }

  const onSignal: NodeJS.SignalsListener = (signal) => {
    logger.warn({ signal }, 'signal received, shutting down');
    abortController.abort();
  };

  const onUncaughtException: NodeJS.UncaughtExceptionListener = (err) => {
    logger.fatal({ err }, 'uncaught exception, shutting down');
    abortController.abort();
  };

  const onUnhandledRejection: NodeJS.UnhandledRejectionListener = (err) => {
    logger.fatal({ err }, 'unhandled rejection, shutting down');
    abortController.abort();
  };

  process
    .once('SIGINT', onSignal)
    .once('SIGTERM', onSignal)
    .on('uncaughtException', onUncaughtException)
    .on('unhandledRejection', onUnhandledRejection);

  return {
    abort: abortController.abort.bind(abortController),
    signal: abortController.signal,
  };
}

type DeferredCleanupFunction = (...args: any[]) => any;
type WithCleanupFunction = (deferredFn: DeferredCleanupFunction) => void;
export async function withCleanup<TFunc extends (defer: WithCleanupFunction) => Promise<any>>(
  func: TFunc
): Promise<ReturnType<TFunc>> {
  const onCleanup: DeferredCleanupFunction[] = [];
  const defer: WithCleanupFunction = (deferredFn) => {
    onCleanup.unshift(deferredFn);
  };

  try {
    return await func(defer);
  } finally {
    let errors = [];
    for (const onCleanupFn of onCleanup) {
      try {
        await onCleanupFn();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Exceptions caught while executing deferred functions');
    }
  }
}

export class AggregateError extends Error {
  constructor(readonly errors: Iterable<Error>, readonly message: string = '') {
    super(message);
    this.name = 'AggregateError';
  }
}
