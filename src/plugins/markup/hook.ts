import { useContext, useEffect, useMemo } from 'react';
import { invariant } from '../../invariant';
import { MarkupContext } from './context';
import type { MarkupOptions } from './options';

export function useMarkup(options: MarkupOptions) {
  const manager = useContext(MarkupContext);

  invariant(
    manager,
    'Missing a MarkupProvider. Did you forget to include the "nostalgie/markup/plugin" plugin?'
  );

  const disposeLayer = useMemo(
    () => manager.createLayer(options),
    [manager, options]
  );

  // Make sure we clean up the layer
  useEffect(() => {
    return () => disposeLayer(document);
  }, [disposeLayer]);
}
