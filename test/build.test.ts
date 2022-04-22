///<reference types="jest" />

import { Background } from '@ggoodman/context';
import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import type { OutputChunk } from 'rollup';
import { buildProject } from '../src/build';
import { readConfigs } from '../src/config';
import { SilentLogger } from '../src/logging';
import { NOSTALGIE_BOOTSTRAP_SCRIPT_ID } from '../src/runtime/server/constants';

async function first<T>(iter: AsyncIterable<T>): Promise<T> {
  for await (const value of iter) {
    return value;
  }

  throw new Error('No value emitted');
}

describe('buildProject', () => {
  const logger = new SilentLogger();

  it('builds a project', async () => {
    const ctx = Background();
    const { config } = await first(
      readConfigs(ctx, logger, `${__dirname}/scenarios/basic`)
    );
    const { clientBuild, serverBuild } = await buildProject(
      ctx,
      logger,
      config,
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
      "<!DOCTYPE html><html lang=\\"en\\"><head><link href=\\"/assets/nostalgie.client.243fa4ea.js\\" rel=\\"modulepreload\\"><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width\\"><title>Nostalgie project</title><meta name=\\"description\\" content=\\"Nostalgie starter project\\"></head><body><div id=\\"root\\"><span>Hello Nostalgie</span></div><script type=\\"module\\" defer async id=\\"nostalgie-bootstrap\\">
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

    const { document } = parseHTML(result.response.body);
    const root = document.getElementById('root')!;
    const preloadHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')
    ).map((link) => link.getAttribute('href'));
    const bootstrapScriptEl = document.getElementById(
      NOSTALGIE_BOOTSTRAP_SCRIPT_ID
    );
    const serverRendererPath =
      bootstrapScriptEl?.textContent?.match(/from\s"([^"]+)"/)?.[1];

    // Let's make sure we can find the main bootstrap file in the preloads.
    expect(serverRendererPath).toBeTruthy();
    expect(preloadHrefs).toContain(serverRendererPath);

    expect(root.textContent).toMatchInlineSnapshot(`"Hello Nostalgie"`);
  });

  it('will inline lazy components', async () => {
    const ctx = Background();
    const { config } = await first(
      readConfigs(ctx, logger, `${__dirname}/scenarios/lazy`)
    );
    const { clientBuild, serverBuild } = await buildProject(
      ctx,
      logger,
      config,
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
          "assets/nostalgie.client.d0a08269.js",
        ],
        Array [
          "chunk",
          "assets/nostalgie.client.2e352ba1.js",
        ],
        Array [
          "chunk",
          "assets/lazy.5c6f8b84.js",
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
      "<!DOCTYPE html><html lang=\\"en\\"><head><link href=\\"/assets/nostalgie.client.d0a08269.js\\" rel=\\"modulepreload\\"><link href=\\"/assets/nostalgie.client.2e352ba1.js\\" rel=\\"modulepreload\\"><link href=\\"/assets/lazy.5c6f8b84.js\\" rel=\\"modulepreload\\"><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width\\"><title>Nostalgie project</title><meta name=\\"description\\" content=\\"Nostalgie starter project\\"></head><body><div id=\\"root\\"><span>I was lazy loaded</span></div><script type=\\"module\\" defer async id=\\"nostalgie-bootstrap\\">
      import { render } from \\"/assets/nostalgie.client.d0a08269.js\\";

      render({\\"lazy-plugin\\":[[\\"lazy.tsx\\",\\"/assets/lazy.5c6f8b84.js\\"]]});
          </script></body></html>"
    `);
    expect(Object.fromEntries(result.response.headers)).toMatchInlineSnapshot(`
      Object {
        "content-type": "text/html",
      }
    `);
    expect(result.response.status).toBe(200);
    expect(result.stats.renderCount).toBe(1);

    const { document } = parseHTML(result.response.body);
    const root = document.getElementById('root')!;
    const preloadHrefs = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')
    ).map((link) => link.getAttribute('href'));
    const bootstrapScriptEl = document.getElementById(
      NOSTALGIE_BOOTSTRAP_SCRIPT_ID
    );
    const serverRendererPath =
      bootstrapScriptEl?.textContent?.match(/from\s"([^"]+)"/)?.[1];

    // Let's make sure we can find the main bootstrap file in the preloads.
    expect(serverRendererPath).toBeTruthy();
    expect(preloadHrefs).toContain(serverRendererPath);

    expect(root.textContent).toMatchInlineSnapshot(`"I was lazy loaded"`);
  });
});
