import * as React from 'react';
import { isMarkupArrayType, MarkupCollector, MarkupContext, MarkupState, MarkupTagType } from '.';
import { invariant } from '../../invariant';
import type { Plugin } from '../plugin';
import { HTML_TAG_MAP, MARKUP_ATTR } from './constants';

export function markupPlugin(defaultMarkupProps: MarkupState = {}): Plugin<MarkupCollector> {
  return {
    name: 'helmetPlugin',
    createState: () => {
      return new MarkupCollector();
    },
    decorateApp(ctx, app) {
      return () =>
        React.createElement(MarkupContext.Provider, { value: ctx.state }, React.createElement(app));
    },
    renderHtml(ctx, document) {
      const state = ctx.state.state;

      applyState(document, state);
    },
    // TODO: How will I allow Plugins to tweak the generated HTML markup?
  };
}

function applyState(document: Document, state: MarkupState) {
  updateAttributes(document, 'body', state.body);
  updateAttributes(document, 'html', state.html);
  updateAttributes(document, 'title', state.title);

  if (
    state.title &&
    typeof state.title.children === 'string' &&
    state.title.children !== document.title
  ) {
    document.title = state.title.children;
  }

  const tags: MarkupTagType[] = ['base', 'meta', 'link', 'script', 'style', 'noscript'];

  for (const tag of tags) {
    if (isMarkupArrayType(tag)) {
      updateTags(document, tag, state[tag] ? state[tag]! : []);
    } else {
      updateTags(document, tag, state[tag] ? [state[tag]!] : []);
    }
  }
}

function updateAttributes(
  document: Document,
  tagType: 'body' | 'html' | 'title',
  props: JSX.IntrinsicElements['body' | 'html' | 'title'] = {}
) {
  const el = document.getElementsByTagName(tagType)[0];

  if (!el) {
    return;
  }

  invariant(el, `Failed to get the element for the tag type ${tagType}`);

  const propNames = Object.keys(props) as Array<keyof typeof props>;
  const attrsToRemove = new Set(el.getAttribute(MARKUP_ATTR)?.split(',') ?? []);
  const controlledAttrs = new Set();

  for (const propName of propNames) {
    // We don't want to apply react-specific props
    if (propName === 'children') continue;

    const htmlAttrName = HTML_TAG_MAP[propName] ?? propName;

    attrsToRemove.delete(htmlAttrName);
    controlledAttrs.add(htmlAttrName);

    if (el.getAttribute(htmlAttrName) !== props[propName]) {
      el.setAttribute(htmlAttrName, props[propName]);
    }
  }

  for (const attrToRemove of attrsToRemove) {
    el.removeAttribute(attrToRemove);
  }

  if (controlledAttrs.size) {
    el.setAttribute(MARKUP_ATTR, [...controlledAttrs].join(','));
  } else {
    el.removeAttribute(MARKUP_ATTR);
  }
}

function updateTags(
  document: Document,
  tagType: MarkupTagType,
  tags: JSX.IntrinsicElements[MarkupTagType][] = []
) {
  const oldEls: HTMLElement[] = Array.prototype.slice.call(
    document.head.querySelectorAll(`${tagType}[${MARKUP_ATTR}]`)
  );

  for (const props of tags) {
    const el = document.createElement(tagType);
    const propNames = Object.keys(props) as Array<keyof typeof props>;

    for (const propName of propNames) {
      const value = props[propName];

      if (propName === 'children') {
        if (typeof value !== 'string') {
          continue;
        }

        if (tagType === 'style') {
          el.appendChild(document.createTextNode(value));
        } else {
          el.innerHTML = value;
        }
        continue;
      }

      const htmlAttrName = HTML_TAG_MAP[propName] ?? propName;

      el.setAttribute(htmlAttrName, value);
    }

    el.setAttribute(MARKUP_ATTR, 'true');

    const oldIdx = oldEls.findIndex((oldEl) => oldEl.isEqualNode(el));

    if (oldIdx >= 0) {
      oldEls.splice(oldIdx, 1);
    } else {
      document.head.appendChild(el);
    }
  }

  for (const oldEl of oldEls) {
    oldEl.parentNode?.removeChild(oldEl);
  }
}
