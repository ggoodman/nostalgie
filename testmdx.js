const mdx = require('@mdx-js/mdx');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { transform } = require('esbuild');


mdx('# Hello world').then(async unwrappedMarkup => {
  const wrappedMarkup = `
    const React = require('react');
    const { mdx, MDXProvider } = require('@mdx-js/react');
    ${unwrappedMarkup}

    const components = {
      h1: (props) => React.createElement('h1', { ...props, className: 'CUSTOM' }),
    };

    return function WithProvider() {
      return (
        <MDXProvider components={components}>
          <MDXContent />
        </MDXProvider>
      );
    }
  `;

  // Transform jsx into js with a `MDXContent` component
  const { code } = await transform(wrappedMarkup, {
    format: 'cjs',
    loader: 'jsx',
  });
  const codeEval = new Function('require', 'module', 'exports', code);
  const module = { exports: {} };
  const WithProvider = codeEval(require, module, exports);
  const model = React.createElement(WithProvider);
  const html = ReactDOMServer.renderToString(model);

  console.log(html);
})

