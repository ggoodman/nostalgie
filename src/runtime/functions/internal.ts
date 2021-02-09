// import { AssertionError } from 'assert';

export enum RPCErrorKind {
  Unknown = 'unknown',
  Internal = 'internal',
  Thrown = 'thrown',
}

export interface UnknownErrorData {
  type: RPCErrorKind.Unknown;
  name: string;
  message: string;
}

export interface InternalErrorData {
  type: RPCErrorKind.Internal;
  name: string;
  message: string;
}

export interface ThrownErrorData {
  type: RPCErrorKind.Thrown;
  name: string;
  message: string;
}

export type ErrorData = UnknownErrorData | InternalErrorData | ThrownErrorData;

const systemErrors = [
  // JavaScript

  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,

  // Node

  // AssertionError,
];

export function errorToWireData(err: unknown): ErrorData {
  if (typeof err !== 'object' || !err || !(err instanceof Error)) {
    return {
      type: RPCErrorKind.Unknown,
      message: 'Unknown error',
      name: 'UnknownError',
    };
  }

  for (let i = 0; i < systemErrors.length; i++) {
    const ctr = systemErrors[i];
    if (err instanceof ctr) {
      return {
        type: RPCErrorKind.Internal,
        message: err.message,
        name: err.name,
      };
    }
  }

  return {
    type: RPCErrorKind.Thrown,
    message: err.message,
    name: err.name,
  };
}
