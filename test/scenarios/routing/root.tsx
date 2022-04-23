import { Outlet } from 'nostalgie/routing';

export default function RootLayout() {
  return (
    <div>
      <nav>Navigation here</nav>
      <Outlet />
      <footer>Footer here</footer>
    </div>
  );
}
