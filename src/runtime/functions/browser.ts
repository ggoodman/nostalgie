///<reference lib="dom" />

export * from 'react-query';

// import type { AbortController, AbortSignal } from 'abort-controller';
import * as React from 'react';
import { QueryObserverResult, useMutation, useQuery } from 'react-query';
import { RPCMimeType, RPCResultKind } from './constants';
import { InternalError, ThrownError, UnknownError } from './errors';
import { ErrorData, RPCErrorKind } from './internal';
import type {
  FunctionMutationOptions,
  FunctionQueryOptions,
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
} from './types';

function createCompoundAbortController(signals: AbortSignal[]): AbortController {
  const controller = new AbortController();
  let pendingSignals = new Set(signals.filter((signal) => !signal.aborted));

  if (!pendingSignals.size) {
    controller.abort();

    return controller;
  }

  const createOnAbort = (signal: AbortSignal) => () => {
    pendingSignals.delete(signal);

    if (!pendingSignals.size) {
      controller.abort();
    }
  };

  for (const signal of signals) {
    signal.onabort = createOnAbort(signal);
  }

  return controller;
}

class RequestBatch {
  private readonly requests: Array<{
    args: any[];
    functionName: string;
    resolve: (v: unknown) => void;
    reject: (err: unknown) => void;
    signal?: AbortSignal;
  }> = [];

  get size() {
    return this.requests.length;
  }

  add(functionName: string, args: any[], signal?: AbortSignal) {
    let resolve: (v: unknown) => void;
    let reject: (err: unknown) => void;

    const promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    this.requests.push({ args, functionName, resolve: resolve!, reject: reject!, signal });

    return promise;
  }

  run(): void {
    const payload: Array<{ functionName: string; args: unknown[] }> = [];
    const signals: AbortSignal[] = [];
    // Bitmask of seen responses
    let seen = 0;

    for (const req of this.requests) {
      payload.push({ functionName: req.functionName, args: req.args });
      if (req.signal) {
        signals.push(req.signal);
      }
    }

    const { signal } = createCompoundAbortController(signals);

    return void fetch(process.env.NOSTALGIE_RPC_PATH!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
      keepalive: true,
    }).then(async (res) => {
      if (res.status !== 200 || !res.body || res.headers.get('content-type') !== RPCMimeType) {
        // TODO: This is a crappy experience. We should have an error protocol.
        throw new Error(`Request failed`);
      }

      for await (const line of readByLine(res.body.getReader())) {
        // Each line will be composed of '<index>\t<E|R>\t<JSON>'
        const parts = line.split('\t', 3);

        if (parts.length !== 3) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Received unexpected line from the Nostalgie RPC endpoint:', line);
          }
          continue;
        }

        const [idxStr, responseType, json] = parts;
        const idx = parseInt(idxStr, 10);
        const req = this.requests[idx];

        if (!req) {
          if (process.env.NODE_ENV === 'development') {
            console.error(
              'Received partial response from the Nostalgie RPC endpoint with an out-of-bounds index (%d):',
              idx,
              line
            );
          }
          continue;
        }

        const mask = 1 << idx;
        if (seen & mask) {
          if (process.env.NODE_ENV === 'development') {
            console.error(
              'Received partial response from the Nostalgie RPC endpoint for a request that already settled (%d):',
              idx,
              line
            );
          }

          continue;
        }
        seen |= mask;

        if (responseType !== RPCResultKind.Error && responseType !== RPCResultKind.Success) {
          if (process.env.NODE_ENV === 'development') {
            console.error(
              'Received partial response from the Nostalgie RPC endpoint with an unexpected response type (%s):',
              responseType,
              line
            );
          }

          continue;
        }

        try {
          const returnValue = JSON.parse(json);

          switch (responseType) {
            case RPCResultKind.Error: {
              // TODO: Error protocol
              req.reject(wireDataToError(returnValue));
              continue;
            }
            case RPCResultKind.Success: {
              // TODO: Error protocol
              req.resolve(returnValue);
              continue;
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error(
              'Received partial response from the Nostalgie RPC endpoint whose payload failed to parse as JSON:',
              line
            );
          }

          continue;
        }
      }
    });
  }
}

async function* readByLine(reader: ReadableStreamDefaultReader) {
  const utf8Decoder = new TextDecoder('utf-8');
  let { value: readChunk, done: readerDone } = await reader.read();
  let chunk = readChunk ? utf8Decoder.decode(readChunk) : '';

  let re = /\n/gm;
  let startIndex = 0;

  while (true) {
    let result = re.exec(chunk);
    if (!result) {
      if (readerDone) {
        break;
      }
      let remainder = chunk.substr(startIndex);
      ({ value: readChunk, done: readerDone } = await reader.read());
      chunk = remainder + (readChunk ? utf8Decoder.decode(readChunk) : '');
      startIndex = re.lastIndex = 0;
      continue;
    }
    yield chunk.substring(startIndex, result.index);
    startIndex = re.lastIndex;
  }

  if (startIndex < chunk.length) {
    // last line didn't end in a newline char
    yield chunk.substr(startIndex);
  }
}

class RequestManager {
  private batchHandle?: number;
  private nextBatch = new RequestBatch();

  dispose() {
    if (this.batchHandle) {
      clearTimeout(this.batchHandle);
    }
  }

  executeRpc<T extends ServerFunction>(
    fn: T,
    args: NonContextFunctionArgs<T>,
    options: { signal?: AbortSignal } = {}
  ): Promise<FunctionReturnType<T>> {
    // If the pending calls array is empty, we can assume that no request is scheduled
    const shouldScheduleRequest = this.nextBatch.size === 0;
    const promise = this.nextBatch.add(fn.name, args, options.signal) as Promise<
      FunctionReturnType<T>
    >;

    if (shouldScheduleRequest) {
      this.scheduleBatch();
    }

    return promise;
  }

  private scheduleBatch() {
    this.batchHandle = (setTimeout(
      () => {
        const batch = this.nextBatch;
        this.nextBatch = new RequestBatch();

        batch.run();
      },
      // ASAP
      0
    ) as unknown) as number;
  }
}

const RequestManagerContext = React.createContext(new RequestManager());

export function useQueryFunctionBrowser<T extends ServerFunction>(
  fn: T,
  args: NonContextFunctionArgs<T>,
  options?: FunctionQueryOptions
) {
  const requestManager = React.useContext(RequestManagerContext);

  return useQuery(
    [fn.name, args],
    () => {
      const abortController = new AbortController() as import('abort-controller').AbortController;
      const resultPromise = requestManager.executeRpc(fn, args, { signal: abortController.signal });

      return Object.assign(resultPromise, {
        cancel() {
          abortController.abort();
        },
      });
    },
    options
  ) as QueryObserverResult<FunctionReturnType<T>>;
}

export function createFunctionMutationBrowser<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionMutationOptions<
    FunctionReturnType<T>,
    unknown,
    NonContextFunctionArgs<T>
  > = {}
) {
  return function useBoundFunctionMutation(
    options: FunctionMutationOptions<FunctionReturnType<T>, unknown, NonContextFunctionArgs<T>>
  ) {
    return useMutationFunctionBrowser(
      fn,
      Object.assign(Object.create(null), factoryOptions, options)
    );
  };
}

export function useMutationFunctionBrowser<T extends ServerFunction>(
  fn: T,
  options: FunctionMutationOptions<FunctionReturnType<T>, unknown, NonContextFunctionArgs<T>> = {}
) {
  const requestManager = React.useContext(RequestManagerContext);

  return useMutation<FunctionReturnType<T>, unknown, NonContextFunctionArgs<T>>((args) => {
    const abortController = new AbortController() as import('abort-controller').AbortController;
    const resultPromise = requestManager.executeRpc(fn, args, { signal: abortController.signal });

    return Object.assign(resultPromise, {
      cancel() {
        abortController.abort();
      },
    });
  }, options);
}

function wireDataToError(data: unknown): Error {
  if (!isWireDataError(data)) {
    // WAT
    if (process.env.NODE_ENV === 'development') {
      console.error('Attempting to decode error data failed for data:', data);
    }

    return new UnknownError('Unknown error');
  }

  switch (data.type) {
    case RPCErrorKind.Internal:
      return new InternalError(data.message);
    case RPCErrorKind.Thrown:
      return new ThrownError(data.message);
    case RPCErrorKind.Unknown:
      return new UnknownError(data.type);
    default:
      throw new Error(
        `Invariant violation: Unexpected wire data error with kind ${JSON.stringify(
          (data as any).type
        )}`
      );
  }
}

function isWireDataError(data: unknown): data is ErrorData {
  if (typeof data !== 'object' || !data) {
    return false;
  }

  if (
    !((data as any) in RPCErrorKind) ||
    typeof (data as any).message !== 'string' ||
    typeof (data as any).name !== 'string'
  ) {
    return false;
  }

  return true;
}
