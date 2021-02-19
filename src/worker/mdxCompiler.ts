import grayMatter from 'gray-matter';
import * as Path from 'path';
import * as Querystring from 'querystring';
//@ts-ignore
import remarkAutolinkHeadings from 'remark-autolink-headings';
import remarkGfm from 'remark-gfm';
//@ts-ignore
import remarkSlug from 'remark-slug';
import type unified from 'unified';
import type unist from 'unist';
import visit from 'unist-util-visit';
import { compile } from 'xdm';
import { createSnippetData } from '../runtime/internal/components/snippetParser';

interface FlowElementAttributeExpression {
  type: 'mdxJsxAttributeValueExpression';
  data: {
    estree: any;
  };
}

type FlowElementAttributeValue = string | FlowElementAttributeExpression;

interface FlowElementAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: FlowElementAttributeValue;
}

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

  const remarkPlugins: unified.PluggableList<unified.Settings> = [
    remarkSnippets,
    remarkGfm,
    remarkAutolinkHeadings,
    remarkSlug,
  ];

  const mdxJsx = await compile(
    { contents: parsed.content, path },
    {
      jsx: true,
      jsxRuntime: 'classic',
      remarkPlugins,
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

/**
 * remarkSnippets is a remark plugin that replaces code blocks with an instance
 * of the Nostalgie `<CodeSnippet>` element, with an augmented representation
 * of the original source code injected as a static prop.
 */
const remarkSnippets: unified.Plugin = () => {
  return async function transformer(tree, file) {
    const codeNodes: unist.Node[] = [];

    // Collect all code blocks w/ a 'lang' attribute
    visit(tree, 'code', (node) => {
      if (!node.lang || !node.value) {
        return;
      }

      codeNodes.push(node);
    });

    if (codeNodes.length) {
      (tree.children as unist.Node[]).unshift({
        type: 'mdxjsEsm',
        value: `import { CodeSnippet } from 'nostalgie/internal/components';`,
        data: {
          estree: createImportAst(),
        },
      });

      await Promise.all(
        codeNodes.map(async (node) => {
          const options = Querystring.parse((node.meta as string) || '', ' ', ':');
          const theme = typeof options.theme === 'string' ? options.theme : undefined;
          const snippetData = await createSnippetData(node.value as string, {
            fromPath: file.path,
            theme,
            lang: node.lang as string,
          });

          let emphasizeRanges: Array<[fromLine: number, toLine: number]> | undefined;

          if (options.emphasize) {
            const rawRanges = Array.isArray(options.emphasize)
              ? options.emphasize
              : [options.emphasize];

            emphasizeRanges = rawRanges.map((range) => {
              // Ranges starts and ends can represented by start:end or start-end.
              const [start, end] = range.split(/[-:]/, 2);

              return [parseInt(start, 10), end ? parseInt(end, 10) : parseInt(start, 10)];
            });
          }

          node.children = [];
          node.type = 'mdxJsxFlowElement';
          node.name = 'CodeSnippet';
          node.attributes = [
            {
              name: 'parseResult',
              type: 'mdxJsxAttribute',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                data: {
                  estree: createJSONParseAST(JSON.stringify(snippetData)),
                },
              },
            },
          ] as FlowElementAttribute[];

          if (emphasizeRanges) {
            (node.attributes as any[]).push({
              name: 'emphasizeRanges',
              type: 'mdxJsxAttribute',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                data: {
                  estree: createRangesArrayAST(emphasizeRanges),
                },
              },
            });
          }
        })
      );
    }
  };
};

function createImportAst() {
  return {
    type: 'Program',
    body: [
      {
        type: 'ImportDeclaration',
        specifiers: [
          {
            type: 'ImportSpecifier',
            imported: {
              type: 'Identifier',
              name: 'CodeSnippet',
            },
            local: {
              type: 'Identifier',
              name: 'CodeSnippet',
            },
          },
        ],
        source: {
          type: 'Literal',
          value: 'nostalgie/internal/components',
          raw: "'nostalgie/internal/components'",
        },
      },
    ],
    sourceType: 'module',
    comments: [],
  };
}

function createRangesArrayAST(ranges: Array<[start: number, end: number]>) {
  return {
    type: 'Program',
    body: [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'ArrayExpression',
          elements: ranges.map(([start, end]) => ({
            type: 'ArrayExpression',
            elements: [
              {
                type: 'Literal',
                value: start,
                raw: JSON.stringify(start),
              },
              {
                type: 'Literal',
                value: end,
                raw: JSON.stringify(end),
              },
            ],
          })),
        },
      },
    ],
    sourceType: 'module',
    comments: [],
  };
}

function createJSONParseAST(value: string) {
  return {
    type: 'Program',
    body: [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'Identifier',
              name: 'JSON',
            },
            property: {
              type: 'Identifier',
              name: 'parse',
            },
            computed: false,
            optional: false,
          },
          arguments: [
            {
              type: 'Literal',
              value: value,
              raw: JSON.stringify(value),
            },
          ],
          optional: false,
        },
      },
    ],
    sourceType: 'module',
    comments: [],
  };
}
