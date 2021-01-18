import type { MDXProviderProps } from '@mdx-js/react';
import type * as React from 'react';

export interface MDXComponentProps extends Partial<MDXProviderProps> {}

declare global {
  declare module '*.css' {
    const value: string;
    /**
     * A URI pointing to the external stylesheet
     */
    export default value;
  }

  declare module '*.ico' {
    const value: string;
    export default value;
  }

  declare module '*.md' {
    const Component: React.ComponentType<MDXComponentProps>;
    export default Component;
  }

  declare module '*.mdx' {
    const Component: React.ComponentType<MDXComponentProps>;
    export default Component;
  }

  declare module '*.png' {
    const value: string;
    export default value;
  }

  declare module '*.svg' {
    const Component: React.SVGFactory;
    export const text: string;
    export default Component;
  }
}
