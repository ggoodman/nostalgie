import { Head } from 'nostalgie';
import * as React from 'react';
import { ProseMarkdown } from '../components/Markdown';
import Docs from './Docs.md';

export default function DocsPage() {
  return (
    <>
      <Head.Title>Nostalgie - Docs</Head.Title>

      <ProseMarkdown for={Docs} />
    </>
  );
}
