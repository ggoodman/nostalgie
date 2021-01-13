import { Helmet } from 'nostalgie';
import * as React from 'react';
import { ProseMarkdown } from 'src/components/Markdown';
import Readme from '../../../README.md';

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Home</title>
      </Helmet>

      <ProseMarkdown for={Readme} />
    </>
  );
}
