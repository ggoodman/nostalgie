export { Helmet } from 'react-helmet-async';
export type {
  BodyProps,
  FilledContext,
  HelmetProps,
  HelmetTags,
  HtmlProps,
  LinkProps,
  MetaProps,
  OtherElementAttributes,
} from 'react-helmet-async';

import type { HelmetProps } from 'react-helmet-async';

export const defaultHelmetProps: HelmetProps = {
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
