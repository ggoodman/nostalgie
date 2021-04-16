import type { Headers } from 'headers-utils';

export type HttpMethod = 'get' | 'put' | 'post' | 'patch' | 'delete';

export interface Request {
  path: string;
  method: HttpMethod | (string & {});
  headers: Headers;
  body: unknown;
}
