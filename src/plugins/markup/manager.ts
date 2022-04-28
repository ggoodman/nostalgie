import { applyMarkupToDocument } from './apply';
import { extractMetaName, extractMetaProperty } from './extract';
import { flattenLayers } from './flatten';
import type { MarkupOptions } from './options';

type DisposeFunction = (document: Document) => void;

export class MarkupManager {
  private layers: MarkupOptions[] = [];
  private scheduledIdleCallback: ReturnType<typeof requestIdleCallback> | null =
    null;

  constructor(options?: { baseLayer?: MarkupOptions }) {
    if (options?.baseLayer) {
      this.layers.push(options.baseLayer);
    }
  }

  createLayer(options: MarkupOptions): DisposeFunction {
    // Normalize meta names and properties with special semantics
    // to their fully-expanded form (ie: array / object).
    const layer = normalizeOptions(options);

    const dispose = (document: Document) => {
      const idx = this.layers.indexOf(layer);
      if (idx >= 0) {
        this.layers.splice(idx, 1);
        this.scheduleCallback(document);
      }
    };

    this.layers.push(layer);

    return dispose;
  }

  private scheduleCallback(document: Document) {
    if (
      !this.scheduledIdleCallback &&
      typeof document !== 'undefined' &&
      typeof requestIdleCallback === 'function'
    ) {
      this.scheduledIdleCallback = requestIdleCallback(() => {
        this.scheduledIdleCallback = null;
        this.render(document);
      });
    }
  }

  render(
    document: Document,
    { baseLayer }: { baseLayer?: MarkupOptions } = {}
  ) {
    const layers = baseLayer ? [baseLayer, ...this.layers] : [...this.layers];
    const flattened = flattenLayers(layers);

    applyMarkupToDocument(flattened, document);
  }
}

function normalizeOptions({
  meta: { names = {}, properties = {}, ...meta } = {},
  ...other
}: MarkupOptions): MarkupOptions {
  // const names: MetaNameMap = {};
  // const properties: MetaPropertyMap = {};
  const layer: MarkupOptions = {
    ...other,
    meta,
  };

  for (const [name, content] of Object.entries(names)) {
    extractMetaName(names, name, content);
  }

  for (const [property, content] of Object.entries(properties)) {
    extractMetaProperty(properties, property, content);
  }

  return layer;
}
