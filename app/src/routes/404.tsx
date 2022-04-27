import { useMarkup } from 'nostalgie/markup';

export default function NotFound() {
  useMarkup({
    title: 'Nostalgie - Page Not Found',
  });

  return <h1>Not Found</h1>;
}
