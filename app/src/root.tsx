/// <reference types="vite/client" />

import { useMarkup } from 'nostalgie/markup';
import { Link, Outlet } from 'nostalgie/routing';
import { css, style, styled, useTwind, variant } from 'nostalgie/twind';
import { NavLink } from 'react-router-dom';
import faviconHref from './img/favicon.ico';

const navStyle = style({
  base: 'px-1 sm:px-4 border-b-4',
  variants: {
    color: variant(
      {
        red: 1,
        yellow: 1,
        blue: 1,
        indigo: 1,
        purple: 1,
        pink: 1,
        green: 1,
      },
      (color) => `border-transparent hover:border-${color}-700`
    ),
  },
});

const NavbarAnchor = styled('a', navStyle);

const NavbarLink = styled(NavLink, navStyle);

const description =
  'Nostalgie is an opinionated, full-stack, platform-agnostic framework for building web apps and web pages using React.';

function NostalgieLogo() {
  const tw = useTwind();

  return (
    <Link
      className={tw(
        css({
          '&': {
            '@apply': 'px-4 nostalgie text-3xl font-light tracking-widest',
            display: 'inline-block',
            // visibility: 'hidden',
            // width: unset,
          },

          '&::first-letter': {
            'font-family': 'Monoton, cursive',
            'font-size': '130%',
            'font-weight': 'normal',
            'text-decoration': 'nnderline',
            'text-decoration-color': 'rgba(67, 56, 202)',
            'letter-spacing': 'normal',
            'margin-right': '4px',
            visibility: 'visible',
          },
        })
      )}
      to="/"
    >
      Nostalgie
    </Link>
  );
}

export default function RootLayout() {
  const tw = useTwind();

  useMarkup({
    title: 'Nostalgie',
    lang: 'en',
    links: [{ rel: 'icon', href: faviconHref }],
    meta: {
      charset: 'utf-8',
      names: {
        description,
        keywords: ['react', 'framework', 'ssr', 'full-stack'],
        viewport: {
          'user-scalable': 'no',
        },
      },
      properties: {
        'og:title': 'Nostalgie',
        'og:description': description,
      },
    },
  });

  return (
    <>
      <div
        className={tw('flex flex-col max-h-screen h-screen overflow-hidden')}
      >
        <div className={tw('h-12 flex flex-col border-b border-gray-200')}>
          <nav
            className={tw(
              'flex-1 container flex flex-row items-end mx-auto z-30'
            )}
          >
            <div className={tw('md:w-60 flex-initial')}>
              <NostalgieLogo />
            </div>
            <div
              className={tw(
                'pl-2 sm:pl-8 lg:px-16 flex flex-row items-center space-x-1 md:text-lg font-bold'
              )}
            >
              <NavbarLink
                className={tw(navStyle({ color: 'indigo' }))}
                to="/docs"
              >
                Docs
              </NavbarLink>
              <NavbarLink color="green" to="/changelog">
                Changelog
              </NavbarLink>
              <NavbarAnchor
                color="blue"
                href="https://discord.gg/dSHCnQxbba"
                title="Join the community on Discord!"
              >
                Discord
              </NavbarAnchor>
              <NavbarAnchor
                color="red"
                href="https://github.com/ggoodman/nostalgie"
                title="Check out Nostalgie on GitHub!"
              >
                GitHub
              </NavbarAnchor>
            </div>
          </nav>
        </div>
        <div
          className={tw(
            'flex-1 overflow-x-hidden flex flex-col justify-items-stretch'
          )}
        >
          <div
            className={tw(
              css({
                '@apply': 'container mx-auto antialiased',
                scrollbarGutter: 'stable',
              })
            )}
          >
            <Outlet loading={<h1>Loading...</h1>} />
          </div>
        </div>
      </div>
    </>
  );
}
