export const REACT_TAG_MAP: Record<string, string | undefined> = {
  accesskey: 'accessKey',
  charset: 'charSet',
  class: 'className',
  contenteditable: 'contentEditable',
  contextmenu: 'contextMenu',
  'http-equiv': 'httpEquiv',
  itemprop: 'itemProp',
  tabindex: 'tabIndex',
};

export const HTML_TAG_MAP: Record<string, string | undefined> = Object.keys(REACT_TAG_MAP).reduce(
  (obj, key) => {
    obj[REACT_TAG_MAP[key]!] = key;
    return obj;
  },
  {} as Record<string, string | undefined>
);

export enum TAG_NAMES {
  BASE = 'base',
  BODY = 'body',
  HEAD = 'head',
  HTML = 'html',
  LINK = 'link',
  META = 'meta',
  NOSCRIPT = 'noscript',
  SCRIPT = 'script',
  STYLE = 'style',
  TITLE = 'title',
  FRAGMENT = 'Symbol(react.fragment)',
}

export const VALID_TAG_NAMES = new Set(Object.values(TAG_NAMES));

export const MARKUP_ATTR = 'ns-markup';

// Copyright Facebook, MIT: https://github.com/facebook/react/blob/f227e7f26b81cb1eba0c837ab2acd7fa7f91404f/LICENSE
// See: https://github.com/facebook/react/blob/f227e7f26b81cb1eba0c837ab2acd7fa7f91404f/packages/react-dom/src/shared/DOMProperty.js
export const RESERVED_PROPS = new Set([
  'children',
  'dangerouslySetInnerHTML',
  'defaultValue',
  'defaultChecked',
  'innerHTML',
  'suppressContentEditableWarning',
  'suppressHydrationWarning',
  'style',
]);
export const PROP_TO_ATTR = {
  acceptCharset: 'accept-charset',
  className: 'class',
  htmlFor: 'for',
  httpEquiv: 'http-equiv',
};
