import { Link } from 'nostalgie/routing';
import * as React from 'react';
import './blue.css';
import './shared.css';

export default function Blue() {
  return (
    <>
      <h2>Hello Blue</h2>
      <p>
        When <code>/blue</code> is requested as the entrypoint, the <code>blue.css</code> file
        should have been included in the initial payload. When the user navigates to{' '}
        <code>/blue</code> after the initial load, it should be dynamically injected.
      </p>
      <Link to="/">Home</Link>
    </>
  );
}
