import { Head } from 'nostalgie';
import * as React from 'react';
import { Markdown } from 'src/components/Markdown';
import About from './About.md';

export default function AboutPage() {
  return (
    <>
      <Head.Title>Nostalgie - About</Head.Title>

      <Markdown for={About} />
    </>
  );
}
