import { Helmet } from 'nostalgie';
import * as React from 'react';
import { ProseMarkdown } from '../components/Markdown';
import Docs from './Docs.md';

export default function DocsPage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Docs</title>
      </Helmet>

      <ProseMarkdown for={Docs} />
    </>
  );
}
