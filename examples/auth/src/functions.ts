import type { ServerFunctionContext } from 'nostalgie/functions';

export function hello(ctx: ServerFunctionContext) {
  return `Hello ${
    ctx.auth.isAuthenticated ? (ctx.auth.credentials.user as any).name : '<Anonymous>'
  }`;
}
