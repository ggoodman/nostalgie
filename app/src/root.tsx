import { styled } from 'nostalgie/twind';
import * as React from 'react';
import { Outlet } from 'react-router';
import { Link } from 'react-router-dom';

const HeadLink = styled(Link, {
  base: 'px-2 py-1 hover:text-underline',
});

export default function RootLayout() {
  return (
    <div>
      <nav>
        <HeadLink to="/">Home</HeadLink>
        <HeadLink to="/intro">Intro</HeadLink>
        <HeadLink to="/foo/bar">Foo Bar</HeadLink>
      </nav>
      <Outlet />
    </div>
  );
}
