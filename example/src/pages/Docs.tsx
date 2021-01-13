import sheetUri from 'github-markdown-css/github-markdown.css';
import { Helmet } from 'nostalgie';
import * as React from 'react';
import Docs from './Docs.mdx';

export default function DocsPage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Docs</title>
        <link rel="stylesheet" href={sheetUri} />
      </Helmet>
      <div className="py-3 markdown-body">
        <Docs />
      </div>
    </>
  );
}
