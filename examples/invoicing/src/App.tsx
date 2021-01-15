import { NavLink, Route, Switch } from 'nostalgie';
import * as React from 'react';

const Invoices = React.lazy(() => import('./pages/Invoices'));

export default function App() {
  return (
    <div className="flex flex-col min-h-screen max-h-screen overflow-auto">
      <nav className="flex flex-row flex-initial">
        <NavLink activeClassName="underline" to="/invoices">
          Invoices
        </NavLink>
      </nav>
      <div className="flex flex-row flex-1">
        <React.Suspense fallback={'Loading...'}>
          <Switch>
            <Route path="/invoices">
              <Invoices />
            </Route>
          </Switch>
        </React.Suspense>
      </div>
    </div>
  );
}
