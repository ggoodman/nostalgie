import { RPCErrorKind } from './internal';

export class UnknownError extends Error {
  readonly name = 'UnknownError';
  readonly type = RPCErrorKind.Unknown;
}

export class InternalError extends Error {
  readonly name = 'InternalError';
  readonly type = RPCErrorKind.Internal;
}

export class ThrownError extends Error {
  readonly name = 'ThrownError';
  readonly type = RPCErrorKind.Thrown;
}
