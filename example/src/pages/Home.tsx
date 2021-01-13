import sheetUri from 'github-markdown-css/github-markdown.css';
import { Helmet } from 'nostalgie';
import * as React from 'react';
import Readme from '../../../README.md';

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Home</title>
        <link rel="stylesheet" href={sheetUri} />
      </Helmet>
      <div className="py-3 markdown-body">
        <Readme />
      </div>
    </>
  );
}
