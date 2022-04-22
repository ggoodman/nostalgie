///<reference types="jest" />

import { Background } from '@ggoodman/context';
import { Headers } from 'headers-utils';
import type { OutputChunk } from 'rollup';
import { buildProject } from '../src/build';
import { defineConfig } from '../src/config';
import { SilentLogger } from '../src/logging';

describe('buildProject', () => {
  const logger = new SilentLogger();

  it('builds a project', async () => {
    const { clientBuild, serverBuild } = await buildProject(
      Background(),
      logger,
      defineConfig({
        fileName: '',
        rootDir: `${__dirname}/scenarios/basic`,
        settings: {
          appEntrypoint: './index.tsx',
        },
      }),
      {
        logLevel: 'error',
        noEmit: true,
      }
    );

    expect(clientBuild.output.map((out) => [out.type, out.fileName]))
      .toMatchInlineSnapshot(`
      Array [
        Array [
          "chunk",
          "assets/nostalgie.client.243fa4ea.js",
        ],
        Array [
          "asset",
          "manifest.json",
        ],
      ]
    `);

    expect(serverBuild.output.map((out) => [out.type, out.fileName]))
      .toMatchInlineSnapshot(`
      Array [
        Array [
          "chunk",
          "nostalgie.server.js",
        ],
      ]
    `);

    const chunk = serverBuild.output[0]! as OutputChunk;

    const mod = { exports: {} };
    const serverMod = new Function('require', 'exports', 'module', chunk.code);

    serverMod(require, mod.exports, mod);

    const server = mod.exports as {
      render: import('../src/runtime/server/renderer').ServerRenderer['render'];
    };

    const result = await server.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.response.body).toMatchInlineSnapshot(`
      "<!DOCTYPE html><html lang=\\"en\\"><head><link href=\\"/assets/nostalgie.client.243fa4ea.js\\" rel=\\"modulepreload\\"><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width\\"><title>Nostalgie project</title><meta name=\\"description\\" content=\\"Nostalgie starter project\\"></head><body><div id=\\"root\\"><span>Hello Nostalgie</span></div><script type=\\"module\\" defer async>
      import { render } from \\"/assets/nostalgie.client.243fa4ea.js\\";

      render({});
          </script></body></html>"
    `);
    expect(Object.fromEntries(result.response.headers)).toMatchInlineSnapshot(`
      Object {
        "content-type": "text/html",
      }
    `);
    expect(result.response.status).toBe(200);
    expect(result.stats.renderCount).toBe(1);
  });
});
