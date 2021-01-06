import * as React from 'react';
import { Head, Link } from 'nostalgie';
import Readme from '../../../README.md';
import { Markdown } from 'src/components/Markdown';

export default function HomePage() {
  return (
    <>
      <Head.Title>Nostalgie - Home</Head.Title>

      <Markdown for={Readme} />
    </>
  );
}
