import { Markup } from 'nostalgie/markup';
import { Link, Route, Switch } from 'nostalgie/routing';
import * as React from 'react';
import './red.css';
import './shared.css';

export default function () {
  return (
    <>
      <Markup>
        <title>CSS loading and code-splitting example · Nostalgie</title>
        <meta
          name="description"
          content="A simple example of using Nostalgie to load .css files such that they're correctly split between page loads while being included in the initial render if needed."
        />
      </Markup>
      <main className="prose container mx-auto">
        <h1>Hello Red</h1>
        <p>
          {`The `}
          <code>h1</code>
          {` tag above should be red. Additionally, the imported css should have been included in the initial render.`}
        </p>
        <p>
          {`The `}
          <code>h1</code>
          {` tag above should also be underlined. The underline rule comes from the `}
          <code>shared.css</code>
          {` file. That file is `}
          <em>also</em>
          {` a dependency of the `}
          <code>/blue</code>
          {` route. This example demonstrates that the shared css will correctly be included in the initial render for both routes while never being loaded more than once.`}
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
      </main>
    </>
  );
}
