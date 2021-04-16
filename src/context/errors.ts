export class CancelledError extends Error {}
export class DeadlineExceededError extends Error {}

export type CancellationReason = CancelledError | DeadlineExceededError;

export function isCancelledError(obj: unknown): obj is CancelledError {
  return obj instanceof CancelledError;
}

export function isDeadlineExceededError(obj: unknown): obj is DeadlineExceededError {
  return obj instanceof DeadlineExceededError;
}
