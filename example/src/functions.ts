import type { ServerFunctionContext } from 'nostalgie/functions';

export async function whoami(ctx: ServerFunctionContext) {
  return ctx.auth.isAuthenticated ? (ctx.auth.credentials.user as any).name : 'Nobody';
}
