import { BUNDLED_THEMES, getHighlighter, loadTheme } from '@antfu/shiki';
//@ts-ignore
import mdx from '@mdx-js/mdx';
import { htmlEscape } from 'escape-goat';
import grayMatter from 'gray-matter';
import LRUCache from 'lru-cache';
import * as Path from 'path';
//@ts-ignore
import remarkAutolinkHeadings from 'remark-autolink-headings';
//@ts-ignore
import remarkSlug from 'remark-slug';
import type { Node } from 'unist';
import visit, { SKIP } from 'unist-util-visit';
import { createRequire } from '../createRequire';

const cache = new LRUCache<string, string>({
  max: 1024 * 1024 * 32, // 32 mb
  length(value, key) {
    return value.length + (key ? key.length : 0);
  },
});
const runtimeRequire = createRequire(__filename);

export default async function compileMdx([path, contents]: [path: string, contents: string]) {
  const parsed = grayMatter(contents, {
    excerpt: true,
  });

  if (parsed.data !== undefined && typeof parsed.data !== 'object') {
    throw new Error(
      `Expected front matter for the file ${Path.relative(
        process.cwd(),
        path
      )} to be undefined or an object, got ${JSON.stringify(typeof parsed.data)}`
    );
  }

  const mdxJsx = await mdx(parsed.content, {
    gfm: true,
    filepath: path,
    remarkPlugins: [
      [remarkCodeBlocksShiki, {}],
      [remarkSlug, {}],
      [remarkAutolinkHeadings, {}],
    ],
    skipExport: true,
  });

  const transformed =
    `
import * as React from 'react';
import { mdx, MDXProvider } from ${JSON.stringify(
      runtimeRequire.resolve('@mdx-js/react/dist/esm')
    )};

${mdxJsx}

export const excerpt = ${JSON.stringify(parsed.excerpt || '')};
export const frontmatter = ${JSON.stringify(parsed.data)};
export const source = ${JSON.stringify(contents)};

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

      const cacheKey = JSON.stringify([requestedTheme, node.lang, node.value]);
      let nodeValue = cache.get(cacheKey);

      if (!nodeValue) {
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
        nodeValue = `<pre data-lang="${htmlEscape(
          node.lang
        )}"${styleString}><code>${html}</code></pre>`;

        cache.set(cacheKey, nodeValue);
      }

      (node as any).type = 'html';
      node.value = nodeValue;
      node.children = [];

      return SKIP;
    });
  };
};
