export function invariant<T>(
  value: T,
  message: string
): asserts value is Exclude<T, null | undefined | false | '' | 0> {
  if (!value) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
