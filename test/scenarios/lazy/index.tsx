import { createLazy } from 'nostalgie/lazy';

const useLazy = createLazy(() => import('./lazy'));

export default function App() {
  const lazyComponentState = useLazy();

  if (!lazyComponentState.isSuccess) {
    return <span>Loading...</span>;
  }
  return <lazyComponentState.component />;
}
