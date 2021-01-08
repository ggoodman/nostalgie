import { Head, NavLink, Route, Switch, useFunction } from 'nostalgie';
import * as React from 'react';
import Favicon from './favicon.ico';
import { updateTheCount } from './functions';
import PlunkerImg from './plunker.png';

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
  const hello = useFunction(updateTheCount, [], {
    cacheTime: 20000,
  });

  return (
    <>
      <Head.Link rel="icon" href={Favicon} />
      <Head.Style>{`
      html {
        overflow-x: hidden;
        margin-right: calc(-1 * (100vw - 100%));
      }
      `}</Head.Style>
      <Head.Meta title={String(hello.data)}></Head.Meta>
      <div className="flex flex-col">
        <header className="bg-blue-600 text-gray-50">
          <nav className="flex flex-row flex-nowrap space-x-4 items-end container px-2 mx-auto text-xl h-12">
            <img className="block h-10 w-10 self-center" src={PlunkerImg} />
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
            <Route
              path="/docs"
              element={<input className="m-1 px-2 py-1" type="text" placeholder="Search docs..." />}
            />
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
          <h2 className="text-3xl font-extrabold">{String(hello.data)}</h2>
          <pre>{JSON.stringify(hello, null, 2)}</pre>

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
