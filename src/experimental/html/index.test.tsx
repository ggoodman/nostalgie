import { Headers } from 'headers-utils';
import { useScript } from 'hoofd';
import * as React from 'react';
import { suite, Test } from 'uvu';
import assert from 'uvu/assert';
// import { helmetPlugin } from '../plugins/helmetPlugin';
import { ServerRenderer } from '../serverRenderer';
import { Html, useLang, useLink } from './index';
import { htmlPlugin } from './plugin';

describe('handleRequest', (it) => {
  it('it handles a request', async () => {
    const r = new ServerRenderer({
      appRoot: () => {
        useLang('en-us');
        useLink({
          rel: 'stylesheet',
          href: '/style.css',
        });
        useScript({
          src: 'foo/bar.baz',
          type: 'text/javascript',
        });

        return <h1>Hello world</h1>;
      },
      chunkDependencies: {},
      entrypointUrl: '/entry.js',
      isDevelopmentMode: true,
      plugins: [htmlPlugin()],
    });

    const { response, stats } = await r.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/',
    });

    assert.ok(response);
    assert.ok(stats);
  });

  it('<Html> element', async () => {
    const r = new ServerRenderer({
      appRoot: () => {
        return (
          <Html
            lang="en-ca"
            link={[{ rel: 'stylesheet', href: '/style.css' }]}
            meta={[{ name: 'description', content: 'Meta description' }]}
            script={[{ src: '/script' }]}
            title="Page title"
            titleTemplate="%s - Nostalgie"
          />
        );
      },
      chunkDependencies: {},
      entrypointUrl: '/',
      isDevelopmentMode: true,
      plugins: [htmlPlugin()],
    });

    const { response, stats } = await r.render({
      body: '',
      headers: new Headers(),
      method: 'get',
      path: '/',
    });

    assert.ok(response);
    assert.ok(stats);
  });
});

function describe(title: string, def: (it: Test) => void) {
  const it = suite(title);

  def(it);

  it.run();
}
