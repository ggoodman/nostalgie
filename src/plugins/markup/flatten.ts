import type {
  LinkTagDescription,
  MarkupOptions,
  MetaNameMap,
  MetaPropertyMap,
  MetaTagDescription,
} from './options';

interface LinkWithSelector {
  link: LinkTagDescription;
  selector?: string;
}

export interface FlattenedMarkupOptions {
  lang?: string;
  links: LinkWithSelector[];
  meta: MetaTagDescription;
  title?: string;
}

/**
 * Given a stack of layers of markup options, flatten it down to a single layer
 * while respecting the semantics of the meta tags.
 *
 * @param layers Layers of markup options where the higher layers have priority
 * @returns A flattened representation of the markup options
 */
export function flattenLayers(layers: MarkupOptions[]): FlattenedMarkupOptions {
  const metaNames: MetaNameMap = {};
  const metaProperties: MetaPropertyMap = {};
  const meta: MetaTagDescription = {
    names: metaNames,
    properties: metaProperties,
  };
  const links: LinkWithSelector[] = [];
  const options: FlattenedMarkupOptions = { links, meta };
  const linksBySelector: Map<string, LinkWithSelector> = new Map();

  // Loop from the deepest layer to the top, flattening requested
  // values according to their semantics.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];

    if (layer.title != null && options.title == null) {
      options.title = layer.title;
    }

    if (layer.lang != null && options.lang == null) {
      options.lang = layer.lang;
    }

    if (layer.meta?.charset != null && options.meta?.charset == null) {
      options.meta ??= {};
      options.meta.charset = layer.meta.charset;
    }

    if (
      layer.meta?.['http-equiv'] != null &&
      options.meta?.['http-equiv'] == null
    ) {
      options.meta ??= {};
      options.meta['http-equiv'] = {
        ...options.meta['http-equiv'],
        ...layer.meta['http-equiv'],
      };
    }

    if (layer.meta?.names != null) {
      for (const [name, content] of Object.entries(layer.meta.names)) {
        switch (name as keyof MetaNameMap) {
          case 'creator': {
            metaNames.creator ??= [];
            metaNames.creator.push(...content);
            break;
          }
          case 'keywords': {
            metaNames.keywords ??= [];
            metaNames.keywords.push(...content);
            break;
          }
          case 'viewport': {
            metaNames.viewport ??= {};
            metaNames.viewport = {
              ...metaNames.viewport,
              ...content,
            };
            break;
          }
          default: {
            (metaNames as Record<string, string>)[name] = content;
          }
        }
      }
    }

    if (layer.meta?.properties != null) {
      for (const [property, content] of Object.entries(
        layer.meta.properties as MetaPropertyMap
      )) {
        switch (property as keyof MetaPropertyMap) {
          case 'og:locale:alternate': {
            metaProperties['og:locale:alternate'] ??= [];
            metaProperties['og:locale:alternate'].push(...content);
            break;
          }
          default: {
            (metaProperties as Record<string, string>)[property] = content;
          }
        }
      }
    }

    if (Array.isArray(layer.links)) {
      for (const link of layer.links) {
        const selector = selectorForLink(link);

        if (selector) {
          // We want to dedupe links with 'selectors'
          linksBySelector.set(selector, { selector, link });
        } else {
          links.push({ link });
        }
      }
    }
  }

  links.push(...linksBySelector.values());

  return options;
}

function selectorForLink(link: LinkTagDescription): string | undefined {
  let attrSelectors = '';

  if (link.rel) {
    attrSelectors += `[rel=${JSON.stringify(link.rel)}]`;
  }

  if (link.media) {
    attrSelectors += `[rel=${JSON.stringify(link.media)}]`;
  }

  if (attrSelectors) {
    return `link${attrSelectors}`;
  }
}
