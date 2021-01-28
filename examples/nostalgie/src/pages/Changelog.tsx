///<reference lib="dom" />
import { Helmet } from 'nostalgie/helmet';
import * as React from 'react';
import Changelog from '../../../../CHANGELOG.md';
import { mdxDocsComponents } from '../lib/mdxDocsComponents';
import '../styles/code.css';

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Changelog</title>
      </Helmet>
      <div className="py-3 prose prose-lg max-w-none">
        <Changelog components={mdxDocsComponents} />
      </div>
    </>
  );
}
