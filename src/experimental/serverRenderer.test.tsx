import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import * as React from 'react';
import * as ReactTestUtils from 'react-dom/test-utils';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { createServer } from 'vite';
import { runWithDefer } from 'with-defer';
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
  const appRoot = () => {
    const [text, setText] = React.useState('Hello world');

    React.useEffect(() => {
      console.log('Firing use-effect');
      setText('Goodnight moon');
    }, []);

    return (
      <>
        <Markup>
          <title>It sets the title</title>
        </Markup>
        <h1>{text}</h1>
      </>
    );
  };
  const r = new ServerRenderer({
    appRoot,
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

  const { window, document } = parseHTML(response.body);
  const title = document.querySelector<HTMLTitleElement>('head > title');

  assert.ok(title);
  assert.equal(title?.innerText, 'It sets the title');
  assert.equal(document.title, 'It sets the title');

  assert.equal(document.querySelector('h1')!.innerText, 'Hello world');

  await runWithDefer(async (defer) => {
    const server = await createServer({
      base: '/',
    });
    defer(() => server.close());

    global.window = window;
    global.document = document;
    defer(() => {
      //@ts-ignore
      delete global.window;
      //@ts-ignore
      delete global.document;
    });

    const { hydrateNostalgie } = (await server.ssrLoadModule(
      `${__dirname}/bootstrap.tsx`
    )) as typeof import('./bootstrap');

    // Confirm that SSR worked
    assert.equal(document.querySelector('h1')!.innerText, 'Hello world');

    await ReactTestUtils.act(async () => {
      await hydrateNostalgie(appRoot, {
        lazyComponents: [],
        publicUrl: '/',
      });
    });

    // Confirm that initial hydration worked
    assert.equal(document.querySelector('h1')!.innerText, 'Goodnight moon');
  });
});

HandleRequest.run();
