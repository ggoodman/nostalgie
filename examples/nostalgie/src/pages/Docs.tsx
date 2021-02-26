import { Markup } from 'nostalgie/markup';
import * as React from 'react';
import { mdxDocsComponents } from '../lib/mdxDocsComponents';
import '../styles/code.css';
import Docs from './Docs.mdx';

export default function DocsPage() {
  return (
    <>
      <Markup>
        <title>Nostalgie - Docs</title>
      </Markup>
      <div className="py-3 prose prose-lg max-w-none">
        <Docs components={mdxDocsComponents} />
      </div>
    </>
  );
}
