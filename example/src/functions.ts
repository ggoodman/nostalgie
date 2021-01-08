import type { ServerFunctionContext } from 'nostalgie';

let count = 1;

export async function updateTheCount(_ctx: ServerFunctionContext) {
  return `The cache has been invalidated ${count++} times`;
}
