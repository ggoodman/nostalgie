const kId = Symbol.for('nostalgie.id');

export interface LazyFactoryMetadata {
  id: string;
  sync?: boolean;
}

export function getFactoryMeta(
  factory: unknown
): LazyFactoryMetadata | undefined {
  return (factory as any)?.[kId];
}
