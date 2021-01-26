import { Helmet } from 'nostalgie/helmet';
import * as React from 'react';

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Nostalgie - Not Found</title>
      </Helmet>

      <h1>Page not found</h1>
    </>
  );
}
