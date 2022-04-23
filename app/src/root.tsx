import { Link, Outlet } from 'nostalgie/routing';
import {
  style,
  styled,
  useTwind,
  variant,
  type StyledComponent,
} from 'nostalgie/twind';
import { ComponentProps } from 'react';
import { useMatch } from 'react-router';

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

const NavbarAnchor = withRouteMatch(styled('a', navStyle));

const NavbarLink = withRouteMatch(styled(Link, navStyle));

function withRouteMatch<Component extends StyledComponent<'active', any>>(
  Component: Component
) {
  return function WithRouteMatch(props: ComponentProps<Component>) {
    const active = typeof props.to === 'string' ? !!useMatch(props.to) : false;

    return <Component active={active} {...(props as any)} />;
  };
}

export default function RootLayout() {
  const tw = useTwind();

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
              <Link
                className={tw(
                  'px-4 nostalgie text-3xl font-light tracking-widest'
                )}
                to="/"
              >
                Nostalgie
              </Link>
            </div>
            <div
              className={tw(
                'pl-2 sm:pl-8 lg:px-16 flex flex-row items-center space-x-1 md:text-lg font-bold'
              )}
            >
              <NavbarLink color="indigo" to="/docs">
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
          <Outlet loading={<h1>Loading...</h1>} />
        </div>
      </div>
    </>
  );
}
