import { BUNDLED_THEMES, getHighlighter, loadTheme } from '@antfu/shiki';
//@ts-ignore
import mdx from '@mdx-js/mdx';
import { htmlEscape } from 'escape-goat';
import * as Path from 'path';
import type { Node } from 'unist';
import visit, { SKIP } from 'unist-util-visit';
import { worker } from 'workerpool';
import { createRequire } from '../createRequire';

const runtimeRequire = createRequire(import.meta.url);

worker({
  compileMdx,
});

export default async function compileMdx(path: string, contents: string) {
  const mdxJsx = await mdx(contents, {
    filepath: path,
    remarkPlugins: [[remarkCodeBlocksShiki, {}]],
    skipExport: true,
  });

  const transformed =
    `
import * as React from 'react';
import { mdx, MDXProvider } from ${JSON.stringify(
      runtimeRequire.resolve('@mdx-js/react/dist/esm')
    )};

${mdxJsx}

export default function({ components, ...props } = {}) {
return React.createElement(MDXProvider, { components }, React.createElement(MDXContent, props));
};
  `.trim() + '\n';

  return transformed;
}

interface CodeNode extends Node {
  type: 'code';
  lang?: string;
  meta: string | string[];
  value: string;
}

const remarkCodeBlocksShiki: import('unified').Plugin = () => {
  return async function transformer(tree) {
    const oneDark = await loadTheme(Path.resolve(__dirname, '../src/OneDark.json'));
    const highlighter = await getHighlighter({ themes: [...BUNDLED_THEMES, oneDark] });
    const themeOptionRx = /^theme:(.+)$/;

    visit<CodeNode>(tree, 'code', (node) => {
      if (!node.lang || !node.value) {
        return;
      }

      const meta = Array.isArray(node.meta) ? node.meta : node.meta ? [node.meta] : [];
      const defaultTheme: string = 'One Dark Pro';
      let requestedTheme: string = defaultTheme;

      for (const entry of meta) {
        const matches = entry.match(themeOptionRx);

        if (matches) {
          requestedTheme = matches[1];
        }
      }

      const fgColor = highlighter.getForegroundColor(requestedTheme).toUpperCase();
      const bgColor = highlighter.getBackgroundColor(requestedTheme).toUpperCase();
      const tokens = highlighter.codeToThemedTokens(node.value, node.lang, requestedTheme);
      const lines = tokens.map((lineTokens, zeroBasedLineNumber) => {
        const renderedLine = lineTokens
          .map((token) => {
            const color = token.color;
            const styleString =
              color && color !== fgColor ? ` style="color: ${htmlEscape(color)}"` : '';

            return `<span${styleString}>${htmlEscape(token.content)}</span>`;
          })
          .join('');

        return `<span class="codeblock-line" data-line-number="${
          zeroBasedLineNumber + 1
        }">${renderedLine}</span>`;
      });

      const html = lines.join('\n');
      const styleString = ` style="color: ${htmlEscape(fgColor)};background-color: ${htmlEscape(
        bgColor
      )}"`;

      (node as any).type = 'html';
      node.value = `<pre data-lang="${htmlEscape(
        node.lang
      )}"${styleString}><code>${html}</code></pre>`;
      node.children = [];

      return SKIP;
    });
  };
};
