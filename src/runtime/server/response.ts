import type { Headers } from 'headers-utils';

export interface Response {
  headers: Headers;
  status: number;
  statusText?: string;
  body: unknown;
}
