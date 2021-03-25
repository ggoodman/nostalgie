import { Headers } from 'headers-utils';
import * as React from 'react';
import { suite, Test } from 'uvu';
import assert from 'uvu/assert';
// import { helmetPlugin } from '../plugins/helmetPlugin';
import { ServerRenderer } from '../serverRenderer';
import { Markup } from './index';
import { markupPlugin } from './plugin';

describe('handleRequest', (it) => {
  it('it handles a request', async () => {
    const r = new ServerRenderer({
      appRoot: () => (
        <div>
          <nav>
            <Markup>
              <html about="hello" />
              <title>Nav title</title>
              <style type="text/css">
                {`h1 {
                  color: red;
                }`}
              </style>
            </Markup>
          </nav>
          <main>
            <div>
              <article>
                <Markup>
                  <title>Article title</title>
                </Markup>
              </article>
            </div>
            <Markup>
              <link rel="stylesheet">Hello world</link>
              <title>Main title</title>
              <html lang="en-us" />
            </Markup>
          </main>
        </div>
      ),
      chunkDependencies: {},
      isDevelopmentMode: true,
      plugins: [markupPlugin()],
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
