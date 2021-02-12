import { BUNDLED_THEMES, getHighlighter, loadTheme } from '@antfu/shiki';
import { htmlEscape } from 'escape-goat';
import grayMatter from 'gray-matter';
import type { Element, Text } from 'hast';
import LRUCache from 'lru-cache';
import * as Path from 'path';
//@ts-ignore
import remarkAutolinkHeadings from 'remark-autolink-headings';
import remarkGfm from 'remark-gfm';
//@ts-ignore
import remarkSlug from 'remark-slug';
import visit, { SKIP } from 'unist-util-visit';
import { compile } from 'xdm';

const cache = new LRUCache<string, Element>({
  max: 1024 * 1024 * 32, // 32 mb
  length(value, key) {
    return JSON.stringify(value).length + (key ? key.length : 0);
  },
});

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

  const mdxJsx = await compile(
    { contents: parsed.content, path },
    {
      jsx: true,
      jsxRuntime: 'classic',
      remarkPlugins: [remarkCodeBlocksShiki, remarkGfm, remarkAutolinkHeadings, remarkSlug],
    }
  );

  const transformed =
    `
    ${mdxJsx.toString()}

    export const excerpt = ${JSON.stringify(parsed.excerpt || '')};
    export const frontmatter = ${JSON.stringify(parsed.data)};
    export const source = ${JSON.stringify(contents)};
  `.trim() + '\n';

  return transformed;
}

const remarkCodeBlocksShiki: import('unified').Plugin = () => {
  return async function transformer(tree) {
    // The path is relative to the dist dir where themes will be put in a themes folder
    const oneDark = await loadTheme(Path.resolve(__dirname, './themes/OneDark.json'));
    const highlighter = await getHighlighter({ themes: [...BUNDLED_THEMES, oneDark] });
    const themeOptionRx = /^theme:(.+)$/;

    visit(tree, 'code', (node) => {
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
        const tokens = highlighter.codeToThemedTokens(
          node.value as string,
          node.lang as string,
          requestedTheme
        );
        const children = tokens.map(
          (lineTokens, zeroBasedLineNumber): Element => {
            const children = lineTokens.map((token): Text | Element => {
              const color = token.color;
              const content: Text = {
                type: 'text',
                // Do not escape the _actual_ content
                value: token.content,
              };

              return color && color !== fgColor
                ? {
                    type: 'element',
                    tagName: 'span',
                    properties: {
                      style: `color: ${htmlEscape(color)}`,
                    },
                    children: [content],
                  }
                : content;
            });

            children.push({
              type: 'text',
              value: '\n',
            });

            return {
              type: 'element',
              tagName: 'span',
              properties: {
                className: 'codeblock-line',
                dataLineNumber: zeroBasedLineNumber + 1,
              },
              children,
            };
          }
        );

        nodeValue = {
          type: 'element',
          tagName: 'pre',
          properties: {
            dataLang: htmlEscape(node.lang as string),
            style: `color: ${htmlEscape(fgColor)};background-color: ${htmlEscape(bgColor)}`,
          },
          children: [
            {
              type: 'element',
              tagName: 'code',
              children,
            },
          ],
        };

        cache.set(cacheKey, nodeValue);
      }

      const data = node.data ?? (node.data = {});

      node.type = 'element';
      data.hProperties ??= {};
      data.hChildren = [nodeValue];

      return SKIP;
    });
  };
};
