export interface Idle<TComponent extends React.ComponentType<any>> {
  readonly status: 'idle';
  readonly isIdle: true;
  readonly isLoading: false;
  readonly isSuccess: false;
  readonly isError: false;
  readonly factory: () => Promise<{ default: TComponent }>;
}

export interface Loading<TComponent extends React.ComponentType<any>> {
  readonly status: 'loading';
  readonly isIdle: false;
  readonly isLoading: true;
  readonly isSuccess: false;
  readonly isError: false;
  readonly promise: Promise<{ default: TComponent }>;
}

export interface Resolved<TComponent extends React.ComponentType<any>> {
  readonly status: 'success';
  readonly isIdle: false;
  readonly isLoading: false;
  readonly isSuccess: true;
  readonly isError: false;
  readonly component: TComponent;
}

export interface Rejected {
  readonly status: 'error';
  readonly isIdle: false;
  readonly isLoading: false;
  readonly isSuccess: false;
  readonly isError: true;
  readonly error: Error;
}

export type LoadState<
  T extends React.ComponentType<any> = React.ComponentType<any>
> = Idle<T> | Resolved<T> | Rejected | Loading<T>;
