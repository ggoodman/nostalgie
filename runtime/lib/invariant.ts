export function invariant<T>(
  value: T,
  message: string
): asserts value is Exclude<T, null | undefined> {
  if (value == null) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
