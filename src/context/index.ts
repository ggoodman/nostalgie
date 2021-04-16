import { createContextImplementation } from './factory';

// We assume that we're running in an environment where setTimeout and clearTimeout are globally
// available.
declare function setTimeout(
  handler: (...args: any[]) => void,
  timeout?: number,
  ...args: any[]
): number;
declare function clearTimeout(handle: number): void;

export const { context: Background, isContext } = createContextImplementation({
  clearTimeout,
  currentTime: () => Date.now(),
  setTimeout,
});

export type { Context } from './context';
export * from './wiring';
