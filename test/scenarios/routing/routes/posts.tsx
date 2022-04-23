import { Outlet } from 'nostalgie/routing';

export default function Posts() {
  return (
    <main>
      <h1>Posts</h1>
      <Outlet />
    </main>
  );
}
