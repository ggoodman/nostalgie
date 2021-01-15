///<reference lib="dom" />
import type { MDXProviderComponents } from '@mdx-js/react';
import { Helmet } from 'nostalgie';
import * as React from 'react';
import Readme from '../../../README.md';

const components: MDXProviderComponents = {
  img: (props) => <img {...props} className="h-4 inline-block" />,
  pre: (props) => <pre {...props} className="bg-gray-800 overflow-auto" />,
};

export default function HomePage() {
  useStylesheet(`
pre[data-lang]::before {
  content: attr(data-lang);
  margin-right: 0;
  text-align: right;
  float: right;
  opacity: 80%;
}

pre span[data-line-number]::before {
  content: attr(data-line-number);
  width: 2em;
  opacity: 80%;
  font-size: 90%;
  text-align: right;
  display: inline-block;
  padding: 0 0.4em;
}
  `);
  return (
    <>
      <Helmet>
        <title>Nostalgie - Home</title>
      </Helmet>
      <div className="py-3 prose prose-lg max-w-none">
        <Readme components={components} />
        <Test />
      </div>
    </>
  );
}

function Test() {
  const [state] = React.useState('test');

  return <h1>{`Test ${state}`}</h1>;
}

function useStylesheet(rules: string) {
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
