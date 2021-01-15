import * as React from 'react';

export default function WrapTest(props: React.PropsWithChildren<{}>) {
  return (
    <div>
      <span>Wrapped</span>
      {props.children}
    </div>
  );
}
