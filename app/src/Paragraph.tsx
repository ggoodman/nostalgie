import { styled } from 'nostalgie/twind';
import * as React from 'react';
import Intro from './docs/Intro.mdx';

const Heading = styled('h1', {
  base: 'blocking-4 font-extrabold text-gray-800',
  variants: {
    size: {
      lg: 'text-8xl pt-8 pb-10',
    },
  },
});

const P = styled('div', {
  base: {
    [Heading]: {
      color: 'red',
    },
  },
});

export default function Paragraph() {
  return (
    <>
      <P>
        <Heading>Red</Heading>
      </P>
      <Heading size="lg">THIS is the 2nd-degree, lazy-loaded component</Heading>
      <Intro />
    </>
  );
}
