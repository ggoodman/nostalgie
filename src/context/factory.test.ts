///<reference types="node" />

import { suite, Test } from 'uvu';
import * as assert from 'uvu/assert';
import { isCancelledError, isDeadlineExceededError } from './errors';
import { ContextHost, createContextImplementation } from './factory';

describe('createContextImplementation', (it) => {
  it('will expose a Background context that is not cancelled and can be asserted as a Context', () => {
    const { context: Background, isContext } = createContextImplementation({
      clearTimeout,
      currentTime: () => Date.now(),
      setTimeout,
    });

    assert.not(Background.cancellationReason);
    assert.ok(isContext(Background));
  });

  it('will allow a child Context to be cancelled without affecting a parent', () => {
    const { context: Background } = createContextImplementation({
      clearTimeout,
      currentTime: () => Date.now(),
      setTimeout,
    });

    const { cancel, context } = Background.withCancel();

    assert.not(Background.cancellationReason);
    assert.not(context.cancellationReason);

    cancel();

    assert.not(Background.cancellationReason);
    assert.ok(isCancelledError(context.cancellationReason));
  });

  it('will cancel child contexts when their parent contexts are cancelled', () => {
    const { context: Background } = createContextImplementation({
      clearTimeout,
      currentTime: () => Date.now(),
      setTimeout,
    });

    const { cancel, context } = Background.withCancel();
    const { context: childContext } = context.withCancel();

    assert.not(Background.cancellationReason);
    assert.not(context.cancellationReason);
    assert.not(childContext.cancellationReason);

    cancel();

    assert.not(Background.cancellationReason);
    assert.ok(isCancelledError(context.cancellationReason));
    assert.ok(isCancelledError(childContext.cancellationReason));
  });

  it('will trigger Context onDidCancel callbacks when cancelled', () => {
    let didFireCallback = false;

    const { context: Background } = createContextImplementation({
      clearTimeout,
      currentTime: () => Date.now(),
      setTimeout,
    });

    const { cancel, context } = Background.withCancel();

    context.onDidCancel(() => {
      didFireCallback = true;
    });

    assert.not(didFireCallback);
    cancel();
    assert.ok(didFireCallback);
  });

  it('will trigger Context onDidCancel callbacks asynchronously when registered on a cancelled context', () => {
    let didFireCallback = false;

    const host = new TestContextHost();
    const { context: Background } = createContextImplementation(host);

    const { cancel, context } = Background.withCancel();

    cancel();
    context.onDidCancel(() => {
      didFireCallback = true;
    });
    assert.not(didFireCallback);
    host.advance(1);
    assert.ok(didFireCallback);
    assert.ok(isCancelledError(context.cancellationReason));
  });

  it('will trigger Context onDidCancel callbacks when a timeout deadline is exceeded', () => {
    let didFireCallback = false;

    const host = new TestContextHost();
    const { context: Background } = createContextImplementation(host);

    const { context } = Background.withTimeout(1);

    context.onDidCancel(() => {
      didFireCallback = true;
    });
    assert.not(didFireCallback);
    host.advance(1);
    assert.ok(didFireCallback);
    assert.ok(isDeadlineExceededError(context.cancellationReason));
  });

  it('will trigger Context onDidCancel callbacks when a absolute deadline is exceeded', () => {
    let didFireCallback = false;

    const host = new TestContextHost();
    const { context: Background } = createContextImplementation(host);

    const { context } = Background.withDeadline(1);

    context.onDidCancel(() => {
      didFireCallback = true;
    });
    assert.not(didFireCallback);
    host.advance(1);
    assert.ok(didFireCallback);
    assert.ok(isDeadlineExceededError(context.cancellationReason));
  });

  it('will inherit a shorter parent deadline', () => {
    let didFireCallback = false;

    const host = new TestContextHost();
    const { context: Background } = createContextImplementation(host);

    const { context } = Background.withTimeout(1);
    const { context: childContext } = context.withTimeout(2);

    childContext.onDidCancel(() => {
      didFireCallback = true;
    });
    assert.not(didFireCallback);
    host.advance(1);
    assert.ok(didFireCallback);
    assert.ok(isDeadlineExceededError(context.cancellationReason));
  });

  it('will trigger cancellation if the deadline is exceeded during synchronous execution', () => {
    let didFireCallback = false;

    const host = new TestContextHost();
    const { context: Background } = createContextImplementation(host);
    const { context } = Background.withTimeout(1);

    context.onDidCancel(() => {
      didFireCallback = true;
    });
    assert.not(didFireCallback);
    assert.not(context.cancellationReason);
    host.advance(2, { skipFireEvents: true });
    assert.not(didFireCallback);
    assert.ok(isDeadlineExceededError(context.cancellationReason));
    assert.ok(didFireCallback);
  });
});

interface HandlerChainNode {
  args: any[];
  timeoutAt: number;
  handler: (...args: any[]) => any;
  next?: HandlerChainNode;
}

class TestContextHost implements ContextHost<HandlerChainNode> {
  private head: HandlerChainNode = {
    args: [],
    handler: () => undefined,
    timeoutAt: 0,
  };
  private currentTimeMs = 0;
  readonly clearTimeout: ContextHost<HandlerChainNode>['clearTimeout'];
  readonly setTimeout: ContextHost<HandlerChainNode>['setTimeout'];

  constructor() {
    this.clearTimeout = (handle) => {
      let node: HandlerChainNode | undefined = this.head;

      while (node) {
        if (node.next === handle) {
          node.next = handle.next;
          return;
        }

        node = node.next;
      }
    };

    this.setTimeout = (handler, timeout = 0, ...args) => {
      const timeoutAt = this.currentTimeMs + timeout;
      const handle: HandlerChainNode = {
        args,
        handler,
        timeoutAt,
      };

      let node: HandlerChainNode = this.head;
      while (node.next && node.next.timeoutAt < timeoutAt) {
        node = node.next;
      }

      handle.next = node.next;
      node.next = handle;

      return handle;
    };
  }

  advance(durationMs: number, options: { skipFireEvents?: boolean } = {}) {
    this.currentTimeMs += durationMs;

    if (!options.skipFireEvents) {
      let node = this.head;

      while (node.next && node.next.timeoutAt <= this.currentTimeMs) {
        const next = node.next;
        next.handler(...node.args);

        node.next = next.next;
      }
    }
  }

  currentTime() {
    return this.currentTimeMs;
  }
}

function describe(title: string, def: (it: Test) => void) {
  const it = suite(title);

  def(it);

  it.run();
}
