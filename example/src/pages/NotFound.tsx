import { Head } from 'nostalgie';
import * as React from 'react';
import { ProseMarkdownText } from '../components/Markdown';

export default function DocsPage() {
  return (
    <>
      <Head.Title>Nostalgie - Not Found</Head.Title>

      <ProseMarkdownText>{`# Not Found`}</ProseMarkdownText>
    </>
  );
}
