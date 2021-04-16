export function invariant(check: unknown, message: string): asserts check {
  if (!check) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
