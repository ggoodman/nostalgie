export type HttpMethod = 'get' | 'put' | 'post' | 'patch' | 'delete';

export interface Request {
  path: string;
  method: HttpMethod;
  headers: Headers;
  body: unknown;
}

export interface Response {
  headers: Headers;
  status: number;
  statusText?: string;
  body: unknown;
}
