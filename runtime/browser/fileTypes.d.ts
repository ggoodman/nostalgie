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
}
