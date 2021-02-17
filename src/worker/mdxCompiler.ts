// import { BUNDLED_THEMES, getHighlighter, loadTheme } from '@antfu/shiki';
// import { htmlEscape } from 'escape-goat';
import grayMatter from 'gray-matter';
// import type { Element, Text } from 'hast';
// import LRUCache from 'lru-cache';
import * as Path from 'path';
import * as Querystring from 'querystring';
//@ts-ignore
import remarkAutolinkHeadings from 'remark-autolink-headings';
import remarkGfm from 'remark-gfm';
//@ts-ignore
import remarkSlug from 'remark-slug';
// import visit, { SKIP } from 'unist-util-visit';
import { compile } from 'xdm';
import { createSnippetData, CreateSnippetDataResult } from '../runtime/internal/snippets/parser';

// const cache = new LRUCache<string, Element>({
//   max: 1024 * 1024 * 32, // 32 mb
//   length(value, key) {
//     return JSON.stringify(value).length + (key ? key.length : 0);
//   },
// });

//See: https://regex101.com/r/1XA4NO/1
const rx = /^(?:\ {4}.+\n)+(?!)|^```(?:([^\s\n\r]+)(?:[ \t]+([^\n\r]+))?)?(?:\n|\r\n)?((?:[^`]+|`(?!``))*)(?:\n|\r\n)?```/gm;

export default function handleWorkerRequest([path, contents]: [string, string]) {
  return compileMdx(path, contents);
}

export async function compileMdx(path: string, contents: string) {
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

  const promises: Array<Promise<CreateSnippetDataResult>> = [];

  parsed.content.replace(rx, (_: string, lang: string, meta: string, code: string): string => {
    const options = Querystring.parse(meta, ' ', ':');
    const theme = typeof options.theme === 'string' ? options.theme : undefined;

    promises.push(
      createSnippetData(code, {
        fromPath: path,
        lang: lang || undefined,
        theme,
      })
    );

    return _;
  });

  let withCodeBlocksReplaced = parsed.content;

  if (promises.length) {
    const replacements = await Promise.all(promises);

    const withReplacedSnippets = parsed.content.replace(rx, (...[, , meta]): string => {
      const options = Querystring.parse(meta, ' ', ':');
      let emphasizeRanges: Array<[fromLine: number, toLine: number]> | undefined;

      if (options.emphasize) {
        const rawRanges = Array.isArray(options.emphasize)
          ? options.emphasize
          : [options.emphasize];

        emphasizeRanges = rawRanges.map((range) => {
          const [start, end] = range.split('-', 2);

          return [parseInt(start, 10), end ? parseInt(end, 10) : parseInt(start, 10) + 1];
        });
      }

      return `<CodeSnippet parseResult={JSON.parse(${JSON.stringify(
        JSON.stringify(replacements.shift()!)
      )})} emphasizeRanges={${JSON.stringify(emphasizeRanges)}} />`;
    });

    withCodeBlocksReplaced =
      `
import { CodeSnippet } from 'nostalgie/internal/snippets';

${withReplacedSnippets}
      `.trim() + '\n';
  }

  const mdxJsx = await compile(
    { contents: withCodeBlocksReplaced, path },
    {
      jsx: true,
      jsxRuntime: 'classic',
      remarkPlugins: [remarkGfm, remarkAutolinkHeadings, remarkSlug],
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
