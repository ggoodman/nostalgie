export { Helmet as Markup } from 'react-helmet-async';
export type {
  BodyProps,
  FilledContext,
  HelmetProps as MarkupProps,
  HelmetTags as MarkupTags,
  HtmlProps,
  LinkProps,
  MetaProps,
  OtherElementAttributes,
} from 'react-helmet-async';

import type { HelmetProps as MarkupProps } from 'react-helmet-async';

export const defaultMarkupProps: MarkupProps = {
  htmlAttributes: {
    lang: 'en',
  },
  defaultTitle: 'Nostalgie app',
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
    {
      name: 'description',
      content: 'Web app created using Nostalgie',
    },
  ],
};
