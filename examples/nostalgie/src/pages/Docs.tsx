import { Helmet } from 'nostalgie/helmet';
import * as React from 'react';
import { useStylesheet } from '../hooks/useStylesheet';
import { mdxDocsComponents } from '../lib/mdxDocsComponents';
import Docs from './Docs.mdx';

export default function DocsPage() {
  useStylesheet(`
  pre[data-lang]::before {
    content: attr(data-lang);
    margin-right: 0;
    text-align: right;
    float: right;
    opacity: 80%;
  }
  
  pre[data-lang="ts"] span[data-line-number]::before,
  pre[data-lang="tsx"] span[data-line-number]::before {
    content: attr(data-line-number);
    opacity: 60%;
    text-align: right;
    float: left;
    padding-right: 0.8em;
    width: 2em;
  }
  `);
  return (
    <>
      <Helmet>
        <title>Nostalgie - Docs</title>
        {/* <link rel="stylesheet" href={sheetUri} /> */}
      </Helmet>
      <div className="py-3 prose prose-lg max-w-none">
        <Docs components={mdxDocsComponents} />
      </div>
    </>
  );
}
