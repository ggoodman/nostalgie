interface ServerMethod {
  (ctx: ServerMethodContext, ...args: any[]): Promise<unknown>;
}

export interface ServerMethodContext {
  hello: 'todo';
}

type ServerAPI<TMethods extends Record<string, ServerMethod>> = {
  [TName in keyof TMethods]: TMethods[TName];
};

export function defineServerMethods<
  TMethods extends Record<string, ServerMethod>
>(methods: TMethods): ServerAPI<TMethods> {
  return methods;
}
