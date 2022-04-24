///<reference types="jest" />

import { Background } from '@ggoodman/context';
import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import type { OutputChunk } from 'rollup';
import { buildProject } from '../src/build';
import { readConfigs } from '../src/config';
import { NOSTALGIE_BOOTSTRAP_SCRIPT_ID } from '../src/constants';
import { SilentLogger } from '../src/logging';

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

    expect(serverBuild.output).toHaveLength(1);

    const chunk = serverBuild.output[0]! as OutputChunk;

    const mod = { exports: {} };
    const serverMod = new Function('require', 'exports', 'module', chunk.code);

    serverMod(require, mod.exports, mod);

    const server = mod.exports as {
      render: import('../src/internal/server/serverRenderer').ServerRenderer['render'];
    };

    const result = await server.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/',
    });

    expect(result.errors).toHaveLength(0);
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

    expect(serverBuild.output).toHaveLength(1);

    const chunk = serverBuild.output[0]! as OutputChunk;

    const mod = { exports: {} };
    const serverMod = new Function('require', 'exports', 'module', chunk.code);

    serverMod(require, mod.exports, mod);

    const server = mod.exports as {
      render: import('../src/internal/server/serverRenderer').ServerRenderer['render'];
    };

    const result = await server.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/',
    });

    expect(result.errors).toHaveLength(0);
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

  it('will render nested routes', async () => {
    const ctx = Background();
    const { config } = await first(
      readConfigs(ctx, logger, `${__dirname}/scenarios/routing`)
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

    expect(serverBuild.output).toHaveLength(1);

    const chunk = serverBuild.output[0]! as OutputChunk;

    const mod = { exports: {} };
    const serverMod = new Function('require', 'exports', 'module', chunk.code);

    serverMod(require, mod.exports, mod);

    const server = mod.exports as {
      render: import('../src/internal/server/serverRenderer').ServerRenderer['render'];
    };

    const result = await server.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/posts/123',
    });

    expect(result.errors).toHaveLength(0);
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

    expect(root.textContent).toMatchInlineSnapshot(
      `"Navigation herePostsPost 123Footer here"`
    );
  });
});
