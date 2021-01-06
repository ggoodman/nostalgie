import { Head, Route, Switch, NavLink } from 'nostalgie';
import * as React from 'react';

const About = React.lazy(() => import('./pages/About'));
const Home = React.lazy(() => import('./pages/Home'));

function Loading() {
  console.log('loading');
  return (
    <>
      <Head>
        <link>Foo</link>
        <title>Loading...</title>
      </Head>
      <h1>Loading...</h1>
    </>
  );
}

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <header style={{ flex: '0 0 40px' }}>
        <NavLink exact to="/" activeStyle={{ textDecoration: 'underline' }}>
          Home
        </NavLink>
        <NavLink exact to="/about" activeStyle={{ textDecoration: 'underline' }}>
          About
        </NavLink>
      </header>
      <div style={{ flex: '1' }}>
        <React.Suspense fallback={<Loading />}>
          <Switch>
            <Route exact path="/">
              <Home />
            </Route>
            <Route exact path="/about">
              <About />
            </Route>
          </Switch>
        </React.Suspense>
      </div>
    </div>
  );
}
