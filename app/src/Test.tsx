import * as React from 'react';

const Paragraph = React.lazy(() => import('./Paragraph'));

export default function Test() {
  return (
    <React.Suspense fallback="Loading...">
      <h1 className="text-8xl leading-4 pt-8 pb-10 font-extrabold text-gray-800">
        Hello there
      </h1>
      // <Paragraph />
    </React.Suspense>
  );
}
