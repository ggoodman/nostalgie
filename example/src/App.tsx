import { Helmet, NavLink, Route, Switch } from 'nostalgie';
import * as React from 'react';
import PlunkerImg from './assets/Nostalgie.svg';
import Favicon from './favicon.ico';

const LazyDocsPage = React.lazy(() => import('./pages/Docs'));
const LazyHomePage = React.lazy(() => import('./pages/Home'));
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
            <NavLink
              className="border-b-4 block border-red-600 border-opacity-0 px-3 pb-1"
              to="/"
              exact
              activeClassName="border-opacity-100"
            >
              Home
            </NavLink>
            <NavLink
              className="border-b-4 block border-red-600 border-opacity-0 px-3 pb-1"
              to="/docs"
              activeClassName="border-opacity-100"
            >
              Docs
            </NavLink>
            <div className="flex-1"></div>
            <Route path="/docs">
              <input className="m-1 px-2 py-1" type="text" placeholder="Search docs..." />
            </Route>
            <a
              className="border-b-4 block border-red-600 border-opacity-0 px-3 pb-1"
              href="https://github.com/ggoodman/nostalgie"
              rel="noopener noreferrer _blank"
            >
              On GitHub
            </a>
          </nav>
        </header>
        <div className="flex-1 container px-2 mx-auto">
          <React.Suspense fallback={<Loading />}>
            <Switch>
              <Route exact path="/">
                <LazyHomePage />
              </Route>
              <Route path="/docs">
                <LazyDocsPage />
              </Route>
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
