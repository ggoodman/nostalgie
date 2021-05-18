export function invariant(check: unknown, message: string): asserts check {
  if (!check) {
    const err = new Error(`Invariant violation: ${message}`);

    Error.captureStackTrace(err, invariant);

    throw err;
  }
}
