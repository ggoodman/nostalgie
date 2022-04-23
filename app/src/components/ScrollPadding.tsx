import { css, useTwind } from 'nostalgie/twind';
import { PropsWithChildren, PropsWithRef } from 'react';

export function ScrollPadding({
  style,
  ...props
}: PropsWithChildren<PropsWithRef<JSX.IntrinsicElements['div']>>) {
  const tw = useTwind();
  return (
    <div
      {...props}
      className={tw(
        props.className,
        css({
          paddingLeft: 'calc((100vw - 100%) / 2)',
        })
      )}
    />
  );
}
