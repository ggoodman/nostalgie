import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import * as React from 'react';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { Markup } from '../runtime/markup';
import { ServerRenderer } from './serverRenderer';

const HandleRequest = suite('handleRequest');

HandleRequest('it handles a request', async () => {
  const r = new ServerRenderer({
    appRoot: () => <h1>Hello world</h1>,
    chunkDependencies: {},
    isDevelopmentMode: true,
  });

  const { response, stats } = await r.render({
    body: '',
    headers: new Headers(),
    method: 'get',
    path: '/',
  });

  assert.ok(response);
  assert.type(response, 'object');
  assert.equal(response.status, 200);
  assert.equal(stats.renderCount, 1);

  const { document } = parseHTML(response.body);
  const h1 = document.querySelector('h1');

  assert.ok(h1);
  assert.equal(h1?.innerText, 'Hello world');
});

HandleRequest('it sets the browser title', async () => {
  const r = new ServerRenderer({
    appRoot: () => (
      <>
        <Markup>
          <title>It sets the title</title>
        </Markup>
        <h1>Hello world</h1>
      </>
    ),
    chunkDependencies: {},
    isDevelopmentMode: true,
  });

  const { response, stats } = await r.render({
    body: '',
    headers: new Headers(),
    method: 'get',
    path: '/',
  });

  assert.ok(response);
  assert.type(response, 'object');
  assert.equal(response.status, 200);
  assert.equal(stats.renderCount, 1);

  const { document } = parseHTML(response.body);
  const title = document.querySelector<HTMLTitleElement>('head > title');

  assert.ok(title);
  assert.equal(title?.innerText, 'It sets the title');
  assert.equal(document.title, 'It sets the title');
});

HandleRequest.run();
