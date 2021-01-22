declare module '*.css' {
  const url: string;
  /**
   * A URI pointing to the external stylesheet
   */
  export default url;
}

declare module '*.md' {
  import type { MDXProviderProps } from '@mdx-js/react';
  import type * as React from 'react';

  export interface MDXComponentProps extends Partial<MDXProviderProps> {}
  const Component: React.ReactElement<MDXComponentProps>;
  export default Component;
  export const excerpt: string;
  export const frontmatter: { [key: string]: unknown };
  export const source: string;
}

declare module '*.mdx' {
  import type { MDXProviderProps } from '@mdx-js/react';
  import type * as React from 'react';

  export interface MDXComponentProps extends Partial<MDXProviderProps> {}
  const Component: React.ReactElement<MDXComponentProps>;
  export default Component;
  export const excerpt: string;
  export const frontmatter: { [key: string]: unknown };
  export const source: string;
}

declare module '*.ico' {
  const url: string;
  export default url;
}
declare module '*.png' {
  const url: string;
  export default url;
}
declare module '*.jpg' {
  const url: string;
  export default url;
}
declare module '*.jpeg' {
  const url: string;
  export default url;
}
declare module '*.gif' {
  const url: string;
  export default url;
}
declare module '*.webp' {
  const url: string;
  export default url;
}
declare module '*.mp4' {
  const url: string;
  export default url;
}
declare module '*.ogg' {
  const url: string;
  export default url;
}
declare module '*.mp3' {
  const url: string;
  export default url;
}
declare module '*.wav' {
  const url: string;
  export default url;
}
declare module '*.flac' {
  const url: string;
  export default url;
}
declare module '*.aac' {
  const url: string;
  export default url;
}
declare module '*.woff' {
  const url: string;
  export default url;
}
declare module '*.woff2' {
  const url: string;
  export default url;
}
declare module '*.eot' {
  const url: string;
  export default url;
}
declare module '*.ttf' {
  const url: string;
  export default url;
}
declare module '*.otf' {
  const url: string;
  export default url;
}

declare module '*.svg' {
  const Component: React.SVGFactory;
  export const text: string;
  export default Component;
}
