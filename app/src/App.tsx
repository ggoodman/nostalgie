import { createLazy } from 'nostalgie/lazy';
import * as React from 'react';

const useLazy = createLazy(() => import('./Test'));

export default function App() {
  const state = useLazy();

  if (state.isSuccess) {
    return <state.component />;
  }

  return <p>Loading...</p>;
}
