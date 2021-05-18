import { createLazy } from 'nostalgie/lazy';
import * as React from 'react';

const useLazy = createLazy(() => import('./Paragraph'));

export default function Test() {
  const state = useLazy();

  if (state.isSuccess) {
    return <state.component />;
  }

  if (state.isLoading) {
    return (
      <h1 className="text-8xl blocking-4 pt-8 pb-10 font-extrabold text-gray-800">
        Loading...
      </h1>
    );
  }

  if (state.isError) {
    return (
      <h1 className="text-8xl blocking-4 pt-8 pb-10 font-extrabold text-gray-800">
        Error: ${state.error.message}
      </h1>
    );
  }

  return (
    <h1 className="text-8xl blocking-4 pt-8 pb-10 font-extrabold text-gray-800">
      Should never happen...
    </h1>
  );
}
