///<reference lib="dom" />
import { Markup } from 'nostalgie/markup';
import * as React from 'react';
import Changelog from '../../../../CHANGELOG.md';
import { mdxDocsComponents } from '../lib/mdxDocsComponents';
import '../styles/code.css';

export default function HomePage() {
  return (
    <>
      <Markup>
        <title>Nostalgie - Changelog</title>
      </Markup>
      <div className="py-3 prose prose-lg max-w-none">
        <Changelog components={mdxDocsComponents} />
      </div>
    </>
  );
}
