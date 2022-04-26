export interface Idle<T> {
  readonly status: 'idle';
  readonly isIdle: true;
  readonly isLoading: false;
  readonly isSuccess: false;
  readonly isError: false;
  readonly factory: () => Promise<T>;
  readonly url: string;
}

export interface Loading<T> {
  readonly status: 'loading';
  readonly isIdle: false;
  readonly isLoading: true;
  readonly isSuccess: false;
  readonly isError: false;
  readonly promise: Promise<T>;
  readonly url: string;
}

export interface Resolved<T> {
  readonly status: 'success';
  readonly isIdle: false;
  readonly isLoading: false;
  readonly isSuccess: true;
  readonly isError: false;
  readonly url: string;
  readonly value: T;
}

export interface Rejected {
  readonly status: 'error';
  readonly isIdle: false;
  readonly isLoading: false;
  readonly isSuccess: false;
  readonly isError: true;
  readonly error: Error;
  readonly url: string;
}

export type LoadState<T> = Idle<T> | Resolved<T> | Rejected | Loading<T>;
