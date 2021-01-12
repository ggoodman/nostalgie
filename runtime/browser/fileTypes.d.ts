import type * as React from 'react';
import type { MarkdownComponent } from './markdown';

declare global {
  module '*.ico' {
    const value: string;
    export default value;
  }

  module '*.md' {
    const Component: MarkdownComponent;
    export const text: string;
    export default Component;
  }

  module '*.png' {
    const value: string;
    export default value;
  }

  module '*.svg' {
    const Component: React.SVGFactory;
    export const text: string;
    export default Component;
  }
}
