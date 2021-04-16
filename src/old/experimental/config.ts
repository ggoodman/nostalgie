import type { ServerPlugin } from './serverPlugin';

export interface NostalgieConfigurationOptions {
  /**
   * Path to the application's main entrypoint.
   *
   * The application's main entrypoint must have a default export that is a React component.
   * The exported component is what will be rendered by Nostalgie.
   */
  appEntrypoint: string;

  /**
   * Path to the application's server functions entrypoint.
   *
   * When a Nostalgie application wishes to leverage server functions, it must be configured with
   * a functions entrypoint. The functions exported by this file will be automatically available by
   * logic running in the main application via `nostalgie/functions`.
   */
  functionsEntrypoint?: string;

  plugins?: ServerPlugin[];
}

export function createConfig(config: NostalgieConfigurationOptions): NostalgieConfigurationOptions {
  return config;
}
