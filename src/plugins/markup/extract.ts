import type {
  LinkTagDescription,
  MarkupOptions,
  MetaNameMap,
  MetaPropertyMap,
  MetaTagDescription,
} from './options';

type Suggest<T extends string> = T | ({} & string);

export function extractMetaName(
  names: MetaNameMap,
  name: Suggest<keyof MetaNameMap>,
  value: string
) {
  switch (name) {
    case 'creator': {
      names.creator ??= [];
      if (Array.isArray(value)) {
        names.creator.push(...value);
      } else {
        names.creator.push(value);
      }
      break;
    }
    case 'keywords': {
      const keywords =
        typeof value === 'string' ? value.split(/\s*,\s*/) : value;

      if (keywords.length) {
        names.keywords ??= [];

        // Only add unique keywords
        for (const keyword of keywords) {
          if (names.keywords.indexOf(keyword) === -1) {
            names.keywords.push(keyword);
          }
        }
      }
      break;
    }
    case 'viewport': {
      if (typeof value === 'string') {
        const pairs = value.split(/\s*,\s*/).map((pair) => pair.split('=', 2));
        value = Object.fromEntries(pairs);
      }

      names.viewport ??= {};

      Object.assign(names.viewport, value);

      break;
    }
    default: {
      (names as Record<string, string>)[name] = value;
    }
  }
}

export function extractMetaProperty(
  properties: MetaPropertyMap,
  property: Suggest<keyof MetaPropertyMap>,
  value: string
) {
  switch (property) {
    case 'og:locale:alternate': {
      properties['og:locale:alternate'] ??= [];
      if (Array.isArray(value)) {
        properties['og:locale:alternate'].push(...value);
      } else {
        properties['og:locale:alternate'].push(value);
      }
      break;
    }
    default: {
      (properties as Record<string, string>)[property] = value;
    }
  }
}

export function extractMarkupOptionsFromDocument(
  document: Document
): MarkupOptions {
  const linkTags: LinkTagDescription[] = [];
  const metaNames: MetaNameMap | Record<string, string> = {};
  const propertyNames: MetaPropertyMap | Record<string, string> = {};
  const meta: MetaTagDescription = {
    names: metaNames,
  };
  const layer: MarkupOptions = {
    meta: meta,
    links: linkTags,
  };

  // Meta tags
  for (const el of Array.from(document.head.querySelectorAll('meta'))) {
    const nameAttr = el.getAttribute('name');

    if (nameAttr != null) {
      const value = el.getAttribute('content');

      if (value != null) {
        extractMetaName(metaNames, nameAttr, value);
      }

      continue;
    }

    const propertyAttr = el.getAttribute('property');

    if (propertyAttr != null) {
      const value = el.getAttribute('content');

      if (value != null) {
        extractMetaProperty(propertyNames, propertyAttr, value);
      }
    }
  }

  console.log('extractMarkupOptionsFromDocument');
  console.dir(layer, { depth: 5 });

  return layer;
}
