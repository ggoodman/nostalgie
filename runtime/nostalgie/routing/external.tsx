import * as React from 'react';
import * as RR from 'react-router-dom';
import { invariant } from '../../lib/invariant';

class RouteChangeState {
  private _childLoadingStates = new Set<RouteChangeState>();
  private _loading = false;

  constructor(private readonly _parent?: RouteChangeState) {}

  get isLoading() {
    return this._loading;
  }

  get isChildLoading() {
    return this._childLoadingStates.size > 0;
  }

  createChild(): RouteChangeState {
    return new RouteChangeState(this);
  }

  setLoading(loading: boolean) {
    if (this._loading !== loading) {
      this._loading = loading;

      // Update parent context values so that the whole
      // tree knows if a child state is loading
      let nextParent = this._parent;

      while (nextParent) {
        if (loading) {
          nextParent._childLoadingStates.add(this);
        } else {
          nextParent._childLoadingStates.delete(this);
        }

        nextParent = nextParent._parent;
      }
    }
  }
}

const rootRouteChangeState = new RouteChangeState();
const RouteChangeStateContext = React.createContext(rootRouteChangeState);
RouteChangeStateContext.displayName = 'RouteChangeStateContext';

export interface RouteProps extends RR.RouteProps {}

export function Route<TProps extends RouteProps>(props: TProps) {
  const { children, ...otherProps } = props;

  return (
    <RR.Route {...otherProps}>
      // The Suspense boundary for the route. If
      <React.Suspense fallback={<RouteLoadingWrapper children={children} />}>
        {React.Children.only(children)}
      </React.Suspense>
    </RR.Route>
  );
}

function RouteLoadingWrapper<TProps extends React.PropsWithChildren<{}>>(props: TProps) {
  const parentRouteChangeState = React.useContext(RouteChangeStateContext);

  invariant(parentRouteChangeState, `Missing a parent route change state`);

  const childRouteChangeState = React.useMemo(() => parentRouteChangeState.createChild(), [
    parentRouteChangeState,
  ]);

  React.useEffect(() => {
    // Set the loading state to true for this node. All parent nodes will
    // get updated as well.
    childRouteChangeState.setLoading(true);

    // When this unmounts, set the loading state to false first so that parent
    // knows can unlink the node and potentially mark that there are no children
    // loading.
    return () => childRouteChangeState.setLoading(false);
  }, [childRouteChangeState]);

  return (
    <RouteChangeStateContext.Provider value={childRouteChangeState}>
      {React.Children.only(props.children)}
    </RouteChangeStateContext.Provider>
  );
}
