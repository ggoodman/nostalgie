import { createRequire as createRequireFromUrl, createRequireFromPath } from 'module';
import * as Url from 'url';

export function createRequire(urlOrPath: string) {
  if (typeof createRequireFromUrl === 'function') {
    return createRequireFromUrl(urlOrPath);
  }

  let pathname = urlOrPath;

  try {
    const parsedUrl = Url.parse(urlOrPath);

    pathname = parsedUrl.pathname!;
  } catch {}

  return createRequireFromPath(pathname);
}
