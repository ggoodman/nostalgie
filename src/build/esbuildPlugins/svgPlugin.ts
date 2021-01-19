//@ts-ignore
import svgr from '@svgr/core';
import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';

export function svgPlugin(): Plugin {
  return {
    name: 'svg',
    setup(build) {
      build.onLoad({ filter: /\.svg$/ }, async ({ path }) => {
        const content = await Fs.readFile(path, 'utf8');
        const jsx = await svgr(
          content,
          {
            icon: true,
            dimensions: false,
          },
          {
            filePath: path,
          }
        );

        return {
          contents: `
            ${jsx};
            export const text = ${JSON.stringify(content)};
          `,
          loader: 'jsx',
        };
      });
    },
  };
}
