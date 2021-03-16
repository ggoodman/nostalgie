import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import React from 'react';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { ServerRenderer } from './handleRequest';

const HandleRequest = suite('handleRequest');

HandleRequest('it handles a request', async () => {
  const r = new ServerRenderer({
    appRoot: () => React.createElement('h1', null, 'Hello world'),
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

  const html = parseHTML(response.body);
  const h1 = html.document.querySelector('h1');

  assert.equal(h1?.innerText, 'Hello world');
});

HandleRequest.run();
