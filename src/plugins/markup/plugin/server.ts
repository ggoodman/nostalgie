import { createElement } from 'react';
import type { ServerPlugin } from '../../../internal/server';
import { MarkupContext } from '../context';
import { MarkupLayer, MarkupManager } from '../manager';
import type {
  LinkTagDescription,
  MetaNameMap,
  MetaTagDescription,
  PropertyNameMap,
} from '../options';
import { pluginName } from './plugin';

export default function createPlugin(): ServerPlugin<{
  baseLayer?: MarkupLayer;
  manager: MarkupManager;
}> {
  return {
    name: pluginName,
    createState() {
      return {
        manager: new MarkupManager(),
      };
    },
    decorateApp(ctx, app) {
      return function ServerMarkupProvider() {
        return createElement(
          MarkupContext.Provider,
          { value: ctx.state.manager },
          createElement(app)
        );
      };
    },
    renderHtml(ctx, document) {
      ctx.state.baseLayer = createBaseLayer(document);
      ctx.state.manager.render(document);
    },
    getClientBootstrapData(ctx) {
      console.log('getClientBootstrapData');
      console.dir(ctx.state.baseLayer, { depth: 4 });
      return ctx.state.baseLayer;
    },
  };
}

interface SemanticMetaNameHandler {
  (names: MetaNameMap, value: string): void;
}

const semanticMetaNamePairs: Array<
  [keyof MetaNameMap, SemanticMetaNameHandler]
> = [
  [
    'creator',
    (names, value) => {
      names.creator ??= [];
      names.creator.push(value);
    },
  ],
  [
    'viewport',
    (names, value) => {
      const pairs = value.split(/\s*,\s*/).map((pair) => pair.split('=', 2));
      const viewport = Object.fromEntries(pairs);

      names.viewport ??= {};

      Object.assign(names.viewport, viewport);

      console.log('viewport', value, viewport);
    },
  ],
];
const semanticMetaNames: Map<string, SemanticMetaNameHandler> = new Map(
  semanticMetaNamePairs
);

interface SemanticPropertyNameHandler {
  (map: PropertyNameMap, value: string): void;
}

const semanticMetaPropertyPairs: Array<
  [keyof PropertyNameMap, SemanticPropertyNameHandler]
> = [
  [
    'og:locale:alternate',
    (map, value) => {
      map['og:locale:alternate'] ??= [];
      map['og:locale:alternate'].push(value);
    },
  ],
];
const semanticMetaProperties: Map<string, SemanticPropertyNameHandler> =
  new Map(semanticMetaPropertyPairs);

export function createBaseLayer(document: Document): MarkupLayer {
  const linkTags: LinkTagDescription[] = [];
  const metaNames: MetaNameMap | Record<string, string> = {};
  const propertyNames: PropertyNameMap | Record<string, string> = {};
  const meta: MetaTagDescription = {
    names: metaNames,
  };
  const layer: MarkupLayer = {
    meta: meta,
    links: linkTags,
  };

  // Meta tags
  for (const el of Array.from(document.head.querySelectorAll('meta'))) {
    const nameAttr = el.getAttribute('name');

    if (nameAttr != null) {
      const value = el.getAttribute('content');

      if (value != null) {
        const semanticHandler = semanticMetaNames.get(nameAttr);

        if (semanticHandler) {
          semanticHandler(metaNames, value);
        } else {
          // This is a bit unsafe since we're ignoring the typed keys for
          // semantic meta names.
          (metaNames as Record<string, string>)[nameAttr] = value;
        }
      }
      continue;
    }

    const propertyAttr = el.getAttribute('property');

    if (propertyAttr != null) {
      const value = el.getAttribute('content');

      if (value != null) {
        const semanticHandler = semanticMetaProperties.get(propertyAttr);

        if (semanticHandler) {
          semanticHandler(propertyNames, value);
        } else {
          // This is a bit unsafe since we're ignoring the typed keys for
          // semantic meta names.
          (propertyNames as Record<string, string>)[propertyAttr] = value;
        }
      }
    }
  }

  console.log('createBaseLayer', layer);

  return layer;
}
