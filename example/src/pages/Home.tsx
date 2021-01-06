import * as React from 'react';
import { Head, Link } from 'nostalgie';
import Readme from '../../../README.md';
import { ProseMarkdown } from 'src/components/Markdown';

export default function HomePage() {
  return (
    <>
      <Head.Title>Nostalgie - Home</Head.Title>

      <ProseMarkdown for={Readme} />
    </>
  );
}
