import * as React from 'react';

export function useStylesheet(rules: string) {
  React.useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = rules;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [rules]);
}
