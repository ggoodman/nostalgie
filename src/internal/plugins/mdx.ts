import type { PluggableList } from '@mdx-js/mdx/lib/core';
import Debug from 'debug';
import { relative } from 'node:path';
import { SourceMapGenerator } from 'source-map';
import type { ResolvedConfig } from 'vite';
import {} from 'vite';
import { invariant } from '../../invariant';
import type { Plugin } from '../../plugin';

const debug = Debug('nostalgie:plugin:mdx');

export function createMdxPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined = undefined;

  const rootRel = (path: string) => {
    invariant(resolvedConfig, 'Config must be resolved');

    return relative(resolvedConfig.root, path);
  };

  return {
    name: 'nostalgie-mdx-plugin',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfig = config;
    },
    async resolveId(source, importer) {
      if (!source.endsWith('.mdx')) {
        return;
      }

      debug('resolveId(%s, %s)', source, importer);

      const resolveResult = await this.resolve(source, importer, {
        skipSelf: true,
      });

      if (!resolveResult?.id) {
        return;
      }

      debug('resolveId(%s, %s) => ', source, importer, resolveResult.id);

      return {
        id: `${resolveResult.id}`,
      };
    },
    // async load(id) {
    //   if (!id.startsWith('\0') || !id.endsWith('.mdx')) {
    //     return;
    //   }

    //   debug('load(%s)', id);

    //   invariant(resolvedConfig, 'Config must be resolved');

    //   const path = id.slice(1);
    //   const absPath = resolve(resolvedConfig.root, path);
    //   const code = await readFile(absPath, {
    //     encoding: 'utf-8',
    //   });

    //   return {
    //     code,
    //   };
    // },
    async transform(code, id) {
      if (!id.endsWith('.mdx')) {
        return;
      }

      debug('transform(%s, %id)', code.slice(20), id);

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
          { path: id.slice(1), value: code },
          {
            jsx: false,
            jsxRuntime: 'classic',
            remarkPlugins,
            outputFormat: 'program',
            SourceMapGenerator,
          }
        );

        invariant(resolvedConfig, 'Resolved config missing');

        const filename = relative(resolvedConfig.root, id.slice(1));
        const chunks: string[] = [
          vfile.toString(),
          `export const filename = ${JSON.stringify(filename)};`,
          `export const source = ${JSON.stringify(code)};`,
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
          map: vfile.map,
        };
      } catch (err: any) {
        this.error(err);
      }
    },
  };
}
