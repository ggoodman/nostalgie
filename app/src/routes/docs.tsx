import { useMarkup } from 'nostalgie/markup';
import { Outlet } from 'nostalgie/routing';
import { useTwind } from 'nostalgie/twind';

export default function DocsLayout() {
  const tw = useTwind();

  useMarkup({
    meta: {
      'http-equiv': {
        'content-type': 'text/html; charset=utf-8',
      },
    },
  });

  return (
    <div className={tw('px-4 py-6 text-gray-900')}>
      <Outlet />
    </div>
  );
}
