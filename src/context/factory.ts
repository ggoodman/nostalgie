import { Emitter, Event } from 'ts-primitives';
import type { Context } from './context';
import { CancellationReason, CancelledError, DeadlineExceededError } from './errors';

export interface ContextHost<TTimerHandle = number> {
  currentTime(): number;
  clearTimeout(handle: TTimerHandle): void;
  setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): TTimerHandle;
}

export function createContextImplementation<TContextHost extends ContextHost<any>>(
  host: TContextHost
): {
  context: Context;
  isContext(obj: unknown): obj is Context;
} {
  const context = new ContextImpl(host);

  return {
    context,
    isContext,
  };
}

export function isContext(obj: unknown): obj is Context {
  return obj instanceof ContextImpl;
}

interface ContextImplHost extends ContextHost {}

interface ContextImplOptions {
  cancellationReason?: CancellationReason;
  deadlineAt?: number;
}

class ContextImpl implements Context {
  private static cancel(context: ContextImpl, reason?: CancellationReason) {
    if (!context.#cancellationReason) {
      context.#cancellationReason = reason ?? new CancelledError();

      if (context.#onWillCancel) {
        context.#onWillCancel.fire(context.#cancellationReason);
        context.#onWillCancel.dispose();
        context.#onWillCancel = undefined;
      }
    }
  }

  #cancellationReason?: CancellationReason;
  readonly #deadlineAt?: number;
  readonly #host: ContextImplHost;
  #onWillCancel?: Emitter<CancellationReason>;

  constructor(host: ContextImplHost, options: ContextImplOptions = {}) {
    this.#cancellationReason = options.cancellationReason;
    this.#deadlineAt = options.deadlineAt;
    this.#host = host;
  }

  get cancellationReason() {
    if (this.#cancellationReason) {
      return this.#cancellationReason;
    }

    // Lazy check for deadline exceeded
    if (this.#deadlineAt && this.#host.currentTime() > this.#deadlineAt) {
      ContextImpl.cancel(this, new DeadlineExceededError());
    }

    return this.#cancellationReason;
  }

  get onDidCancel() {
    if (this.#cancellationReason) {
      const event: Event<CancellationReason> = (callback, thisArg?) => {
        const handle = this.#host.setTimeout(callback.bind(thisArg), 0);
        return {
          dispose: () => {
            this.#host.clearTimeout(handle);
          },
        };
      };
      return event;
    }

    if (!this.#onWillCancel) {
      this.#onWillCancel = new Emitter();
    }

    return this.#onWillCancel.event;
  }

  run<TFunc extends () => any>(
    fn: TFunc
  ): ReturnType<TFunc> extends PromiseLike<infer U> ? Promise<U> : ReturnType<TFunc> {
    const reason = this.#cancellationReason;
    if (reason) {
      throw reason;
    }

    const result = fn();

    if (result && typeof result['then'] === 'function') {
      let handler: { dispose(): void };

      // Create a Promise that will settle as rejected if the context cancels. We do this to
      // short-circuit the actual method.
      const cancelled = new Promise((_, reject) => {
        handler = this.onDidCancel((r) => {
          console.debug('cancelled race fired', r);
          reject(r);
        });
      });

      // Convert to native Promise
      const resultPromise = Promise.resolve(result);

      // Swallow rejections
      // resultPromise.catch(noop);
      // cancelled.catch(noop);

      const promise = Promise.race([
        cancelled,
        resultPromise,
      ]) as ReturnType<TFunc> extends PromiseLike<infer U> ? Promise<U> : ReturnType<TFunc>;

      promise.catch(noop).then(handler!.dispose());

      return promise;
    }

    return result;
  }

  withCancel() {
    const context = new ContextImpl(this.#host, { deadlineAt: this.#deadlineAt });
    const cancel = (reason?: CancellationReason) =>
      ContextImpl.cancel(context, reason ?? new CancelledError());

    this.onDidCancel(cancel);

    return { cancel, context };
  }

  withDeadline(epochTimeMs: number, options?: { now: number }) {
    const now = options?.now ?? this.#host.currentTime();
    const deadlineAt = this.#deadlineAt ? Math.min(this.#deadlineAt, epochTimeMs) : epochTimeMs;
    const context = new ContextImpl(this.#host, { deadlineAt });
    const cancel = (reason?: CancellationReason) =>
      ContextImpl.cancel(context, reason ?? new CancelledError());

    this.onDidCancel(cancel);

    // We only want to set a timer if we're *reducing* the deadline. Otherwise, we can let
    // the parent context's timer deal with firing the cancellation.
    if (deadlineAt === epochTimeMs) {
      const timeout = () => cancel(new DeadlineExceededError());
      const timerHandle = this.#host.setTimeout(timeout, deadlineAt - now);
      const cancelTimeout = () => this.#host.clearTimeout(timerHandle);

      context.onDidCancel(cancelTimeout);
    }

    return { cancel, context };
  }

  withTimeout(timeoutMs: number) {
    const now = this.#host.currentTime();
    const epochTimeMs = now + timeoutMs;

    return this.withDeadline(epochTimeMs, { now });
  }
}

function noop() {}
