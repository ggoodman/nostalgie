import type { PluggableList } from '@mdx-js/mdx/lib/core';
import { relative } from 'node:path';
import type { ResolvedConfig } from 'vite';
import { invariant } from '../../invariant';
import type { Plugin } from '../../plugin';

export function createMdxPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined = undefined;

  return {
    name: 'nostalgie-mdx-plugin',
    configResolved(config) {
      resolvedConfig = config;
    },
    async transform(code, id, options = {}) {
      if (!id.endsWith('.mdx')) {
        return;
      }

      const [
        { compile },
        { default: remarkFrontMatter },
        { remarkMdxFrontmatter },
      ] = await Promise.all([
        import('@mdx-js/mdx'),
        import('remark-frontmatter'),
        import('remark-mdx-frontmatter'),
      ]);
      const remarkPlugins: PluggableList = [
        remarkFrontMatter,
        [remarkMdxFrontmatter, { name: 'attributes' }],
      ];

      try {
        const vfile = await compile(
          { path: id, value: code },
          {
            jsx: false,
            jsxRuntime: 'classic',
            pragma: 'React.createElement',
            pragmaFrag: 'React.Fragment',
            remarkPlugins,
            outputFormat: 'program',
          }
        );

        invariant(resolvedConfig, 'Resolved config missing');

        const filename = relative(resolvedConfig.root, id);
        const chunks: string[] = [
          `export const filename = ${JSON.stringify(filename)};`,
          `export const source = ${JSON.stringify(code)};`,
          vfile.toString(),
        ];

        for (const message of vfile.messages) {
          if (message.fatal) {
            this.error(message.message, {
              column: message.column!,
              line: message.line!,
            });
          } else {
            this.warn(message.message, {
              column: message.column!,
              line: message.line!,
            });
          }
        }

        return {
          code: chunks.join('\n') + '\n',
        };
      } catch (err: any) {
        this.error(err);
      }
    },
  };
}
