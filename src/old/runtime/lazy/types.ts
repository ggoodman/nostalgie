import type * as React from 'react';

export interface ChunkManager {
  readonly chunks: { chunk: string; lazyImport: string }[];
  readonly lazyComponentState: Map<string, LazyComponentState>;
}

export interface LazyComponentStateLoading {
  readonly state: 'loading';
  readonly loadingPromise: Promise<void>;
}

export interface LazyComponentStateLoaded {
  readonly state: 'loaded';
  readonly component: Parameters<typeof React.createElement>[0];
}

export interface LazyComponentStateError {
  readonly state: 'error';
  readonly error: unknown;
}

export type LazyComponentState =
  | LazyComponentStateLoading
  | LazyComponentStateLoaded
  | LazyComponentStateError;

export interface LazyFactory<T extends React.ComponentType<any>> extends LazyFactoryMeta {
  (): Promise<{ default: T }>;
}

export interface LazyFactoryMeta {
  chunk?: string;
  lazyImport?: string;
  sync?: true;
}
