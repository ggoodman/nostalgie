import { Link, Route, Switch } from 'nostalgie/routing';
import * as React from 'react';
import './red.css';
import './shared.css';

export default function () {
  return (
    <>
      <h1>Hello Red</h1>
      <p>
        {`The `}
        <code>h1</code>
        {` tag above should be red. Additionally, the imported css should have been included in the initial render.`}
      </p>
      <hr />
      <React.Suspense fallback="Loading...">
        <Switch>
          <Route path="/blue" component={React.lazy(() => import('./Blue'))}></Route>
          <Route path="/" exact>
            <Link to="/blue">Blue</Link>
          </Route>
        </Switch>
      </React.Suspense>
    </>
  );
}
