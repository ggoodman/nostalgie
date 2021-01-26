import { Helmet } from 'nostalgie/helmet';
import { NavLink, Route, Switch } from 'nostalgie/routing';
import * as React from 'react';
import PlunkerImg from './assets/Nostalgie.svg';
import Favicon from './favicon.ico';

const pages = [
  {
    display: 'Home',
    path: '/',
    exactPath: true,
    Component: React.lazy(() => import('./pages/Home')),
  },
  {
    display: 'Docs',
    path: '/docs',
    exactPath: false,
    Component: React.lazy(() => import('./pages/Docs')),
  },
];

const LazyNotFoundPage = React.lazy(() => import('./pages/NotFound'));

function Loading() {
  return (
    <>
      <h1>Loading...</h1>
    </>
  );
}

export default function App() {
  return (
    <>
      <Helmet>
        <link rel="icon" href={Favicon} />
        <style>{`
      html {
        overflow-x: hidden;
        margin-right: calc(-1 * (100vw - 100%));
      }
      `}</style>
      </Helmet>
      <div className="flex flex-col">
        <header className="bg-blue-600 text-gray-50">
          <nav className="flex flex-row flex-nowrap space-x-4 items-end container px-2 mx-auto text-xl h-12">
            <PlunkerImg width="22px" className="block h-10 self-center fill-current text-gray-50" />
            {pages.map(({ display, exactPath, path }) => (
              <NavLink
                key={display}
                className="border-b-4 block border-red-600 border-opacity-0 px-3 pb-1"
                to={path}
                exact={exactPath}
                activeClassName="border-opacity-100"
              >
                {display}
              </NavLink>
            ))}
            <div className="flex-1"></div>
            <a
              className="border-b-4 block border-red-600 border-opacity-0 px-3 pb-1 text-lg text-gray-300"
              href="https://github.com/ggoodman/nostalgie"
              rel="noopener noreferrer _blank"
            >
              GitHub
            </a>
          </nav>
        </header>
        <div className="flex-1 container px-2 mx-auto">
          <React.Suspense fallback={<Loading />}>
            <Switch>
              {pages.map(({ Component, display, exactPath, path }) => (
                <Route key={display} exact={exactPath} path={path} component={Component}></Route>
              ))}
              <Route path="/*">
                <LazyNotFoundPage />
              </Route>
            </Switch>
          </React.Suspense>
        </div>
      </div>
    </>
  );
}
