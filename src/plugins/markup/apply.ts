import type { FlattenedMarkupOptions } from './flatten';
import type { LinkTagDescription, MetaNameMap } from './options';

export function applyMarkupToDocument(
  options: FlattenedMarkupOptions,
  document: Document
) {
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
    document.getElementsByTagName('html')[0].setAttribute('lang', options.lang);
  }

  const metaHttpEquivTags = Array.from(
    document.head.querySelectorAll('meta[http-equiv]')
  );
  const metaNameTags = Array.from(document.head.querySelectorAll('meta[name]'));
  const metaPropertyTags = Array.from(
    document.head.querySelectorAll('meta[property]')
  );

  const untrackedMetaTags = new Set([
    ...Array.from(metaHttpEquivTags),
    ...Array.from(metaNameTags),
    ...Array.from(metaPropertyTags),
  ]);

  const httpEquivs = options.meta['http-equiv'];
  if (httpEquivs) {
    for (const [httpEquiv, content] of Object.entries(httpEquivs)) {
      const el =
        document.head.querySelector(
          `meta[http-equiv=${JSON.stringify(httpEquiv)}]`
        ) ?? document.createElement('meta');
      el.setAttribute('http-equiv', httpEquiv);
      el.setAttribute('content', content);
      document.head.prepend(el);
    }
  }

  if (options.meta?.names) {
    const afterEls =
      metaNameTags ??
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

      if (name === 'keywords') {
        if (Array.isArray(content)) {
          content = [...new Set(content)].join(',');
        }
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

      // We've now 'seen' this tag, so let's remove it from the
      // set of untracked tags.
      untrackedMetaTags.delete(el);

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
      metaPropertyTags ??
      document.head.getElementsByTagName('meta') ??
      document.head.getElementsByTagName('title');
    let lastMetaPropertyTag = afterEls[afterEls.length - 1];
    for (const [property, content] of Object.entries(options.meta.properties)) {
      const el =
        document.querySelector(`meta[property=${JSON.stringify(property)}]`) ??
        document.createElement('meta');

      el.setAttribute('content', content);
      el.setAttribute('property', property);

      // Now we've seen this property tag, remove it from the full set.
      untrackedMetaTags.delete(el);

      if (!el.parentElement) {
        if (lastMetaPropertyTag) {
          insertAfter(el, lastMetaPropertyTag);
        } else {
          document.head.appendChild(el);
        }
      }
    }
  }

  for (const { selector, link } of options.links) {
    if (selector) {
      const el =
        document.head.querySelector<HTMLLinkElement>(selector) ??
        document.createElement('link');

      updateAndInsertLink(document, el, link);
    } else {
      updateAndInsertLink(document, document.createElement('link'), link);
    }
  }

  for (const el of untrackedMetaTags) {
    console.log('removing superfluous tag', el);
    el.remove();
  }
}

function insertAfter(newNode: Element, existingNode: Element) {
  existingNode.parentNode!.insertBefore(newNode, existingNode.nextSibling);
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
