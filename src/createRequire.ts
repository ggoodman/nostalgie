import Module from 'module';
import * as Url from 'url';

export function createRequire(urlOrPath: string): NodeRequire {
  if (typeof (Module as any).createRequireFromUrl === 'function') {
    return (Module as any).createRequireFromUrl(urlOrPath);
  }

  let pathname = urlOrPath;

  try {
    const parsedUrl = Url.parse(urlOrPath);

    pathname = parsedUrl.pathname!;
  } catch {}

  return typeof Module.createRequire === 'function'
    ? Module.createRequire(pathname)
    : Module.createRequireFromPath(pathname);
}
