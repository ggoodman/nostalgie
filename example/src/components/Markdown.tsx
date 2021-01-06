import * as React from 'react';
import type { MarkdownComponent } from 'nostalgie';

export function Markdown(props: { for: MarkdownComponent }) {
  return (
    <props.for
      className="p-3 prose prose-sm sm:prose"
      options={{
        overrides: {
          img: {
            props: {
              className: 'h-5 inline-block',
            },
          },
        },
      }}
    />
  );
}
