import { Helmet } from 'nostalgie';
import * as React from 'react';
import { ProseMarkdownText } from '../components/Markdown';

export default function DocsPage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Not Found</title>
      </Helmet>

      <ProseMarkdownText>{`# Not Found`}</ProseMarkdownText>
    </>
  );
}
