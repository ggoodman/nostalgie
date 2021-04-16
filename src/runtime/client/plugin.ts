export interface ClientPluginContext {
  rootElement: HTMLElement;
}

export interface ClientPlugin {
  name: string;
  onBeforeRender?(ctx: ClientPluginContext): void;
}
