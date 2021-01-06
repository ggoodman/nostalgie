export type MarkdownComponent = React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    options?: import('markdown-to-jsx').MarkdownToJSX.Options;
  }
>;
