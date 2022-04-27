import type {
  LinkTagDescription,
  MarkupOptions,
  MetaNameMap,
  MetaTagDescription,
  PropertyNameMap,
} from './options';

type DisposeFunction = (document: Document) => void;

export interface MarkupLayer extends MarkupOptions {}

export class MarkupManager {
  private layers: MarkupLayer[] = [];
  private scheduledIdleCallback: ReturnType<typeof requestIdleCallback> | null =
    null;

  constructor(options?: { baseLayer?: MarkupLayer }) {
    if (options?.baseLayer) {
      this.layers.push(options.baseLayer);
    }
  }

  createLayer(options: MarkupOptions): DisposeFunction {
    const layer: MarkupLayer = { ...options };
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

  render(document: Document) {
    const metaNames: MetaNameMap = {};
    const metaProperties: PropertyNameMap = {};
    const meta: MetaTagDescription = {
      names: metaNames,
      properties: metaProperties,
    };
    const options: MarkupOptions = { meta };
    const linksBySelector: Map<string, LinkTagDescription> = new Map();

    // Loop from the deepest layer to the top, flattening requested
    // values according to their semantics.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];

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
          layer.meta.properties as PropertyNameMap
        )) {
          switch (property as keyof PropertyNameMap) {
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
            linksBySelector.set(selector, link);
          } else {
            options.links ??= [];
            options.links.push(link);
          }
        }
      }
    }

    console.log('render', linksBySelector);
    console.dir(options, { depth: 5 });

    if (options.title != null) {
      const el =
        document.head.getElementsByTagName('title')[0] ??
        document.createElement('title');

      el.innerHTML = options.title;

      if (!el.parentElement) {
        document.head.appendChild(el);
      }
    }

    if (options.lang) {
      document
        .getElementsByTagName('html')[0]
        .setAttribute('lang', options.lang);
    }

    if (options.meta?.names) {
      const afterEls =
        document.head.querySelectorAll('meta[name]') ??
        document.head.getElementsByTagName('meta') ??
        document.head.getElementsByTagName('title');
      let lastMetaNameTag = afterEls[afterEls.length - 1];
      const entries = Object.entries(options.meta.names as MetaNameMap);

      for (let [name, content] of entries) {
        let selector = `meta[name=${JSON.stringify(name)}]`;

        // Creators are arrays of strings
        if (name === 'creator') {
          if (Array.isArray(content)) {
            const uniqueCreators = [...new Set(content)];
            // Nothing to do for empty authors
            if (!uniqueCreators.length) {
              continue;
            }
            content = uniqueCreators[0];

            for (let i = 1; i < uniqueCreators.length; i++) {
              entries.push(['creator', uniqueCreators[i]]);
            }
          }

          selector += `[content=${JSON.stringify(content)}]`;
        }

        const el =
          document.querySelector(selector) ?? document.createElement('meta');

        // Viewport is a complext object we need to serialize
        if (name === 'viewport') {
          content = Object.entries(content)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
        }

        el.setAttribute('content', content);
        el.setAttribute('name', name);

        if (!el.parentElement) {
          if (lastMetaNameTag) {
            insertAfter(el, lastMetaNameTag);
          } else {
            document.head.appendChild(el);
          }
        }

        lastMetaNameTag = el;
      }
    }

    if (options.meta?.properties) {
      const afterEls =
        document.head.querySelectorAll('meta[property]') ??
        document.head.getElementsByTagName('meta') ??
        document.head.getElementsByTagName('title');
      let lastMetaNameTag = afterEls[afterEls.length - 1];
      for (const [property, content] of Object.entries(
        options.meta.properties
      )) {
        const el =
          document.querySelector(
            `meta[property=${JSON.stringify(property)}]`
          ) ?? document.createElement('meta');

        el.setAttribute('content', content);
        el.setAttribute('property', property);

        if (!el.parentElement) {
          if (lastMetaNameTag) {
            insertAfter(el, lastMetaNameTag);
          } else {
            document.head.appendChild(el);
          }
        }
      }
    }

    for (const [selector, link] of linksBySelector) {
      const el =
        document.head.querySelector<HTMLLinkElement>(selector) ??
        document.createElement('link');

      updateAndInsertLink(document, el, link);
    }

    if (options.links) {
      for (const link of options.links) {
        updateAndInsertLink(document, document.createElement('link'), link);
      }
    }
  }
}

function insertAfter(newNode: Element, existingNode: Element) {
  existingNode.parentNode!.insertBefore(newNode, existingNode.nextSibling);
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

function updateAndInsertLink(
  document: Document,
  el: HTMLLinkElement,
  link: LinkTagDescription
) {
  for (const [attr, value] of Object.entries(link)) {
    el.setAttribute(attr.toLowerCase(), value);
  }

  if (!el.parentElement) {
    const links = document.head.getElementsByTagName('link');
    const last = links.length ? links[links.length - 1] : undefined;

    if (last) {
      insertAfter(el, last);
    } else {
      document.head.appendChild(el);
    }
  }
}
