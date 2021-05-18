import type * as React from 'react';

const kId = Symbol.for('nostalgie.id');

export interface LazyFactoryMetadata {
  chunkId: string;
  sync?: boolean;
}

export function getFactoryMeta<TComponent extends React.ComponentType<any>>(
  factory: unknown
): LazyFactoryMetadata | undefined {
  return (factory as any)?.[kId];
}
