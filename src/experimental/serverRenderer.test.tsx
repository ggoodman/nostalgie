import { Headers } from 'headers-utils';
import { parseHTML } from 'linkedom';
import * as React from 'react';
import { suite, Test } from 'uvu';
import assert from 'uvu/assert';
import { markupPlugin } from './markup/plugin';
import { ServerRenderer } from './serverRenderer';

describe('handleRequest', (it) => {
  it('it handles a request', async () => {
    const r = new ServerRenderer({
      appRoot: () => <h1>Hello world</h1>,
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
    assert.type(response, 'object');
    assert.equal(response.status, 200);
    assert.equal(stats.renderCount, 1);

    const { document } = parseHTML(response.body);
    const h1 = document.querySelector('h1');

    assert.ok(h1);
    assert.equal(h1?.innerText, 'Hello world');
  });

  // it('it sets the browser title', async () => {
  //   const appRoot = () => {
  //     const [text, setText] = React.useState('Hello world');

  //     React.useEffect(() => {
  //       console.log('Firing use-effect');
  //       setText('Goodnight moon');
  //     }, []);

  //     return (
  //       <>
  //         <Markup>
  //           <title>It sets the title</title>
  //         </Markup>
  //         <h1>{text}</h1>
  //       </>
  //     );
  //   };
  //   const r = new ServerRenderer({
  //     appRoot,
  //     chunkDependencies: {},
  //     isDevelopmentMode: true,
  //   });

  //   const { response, stats } = await r.render({
  //     body: '',
  //     headers: new Headers(),
  //     method: 'get',
  //     path: '/',
  //   });

  //   assert.ok(response);
  //   assert.type(response, 'object');
  //   assert.equal(response.status, 200);
  //   assert.equal(stats.renderCount, 1);

  //   const { window, document } = parseHTML(response.body);
  //   const title = document.querySelector<HTMLTitleElement>('head > title');

  //   assert.ok(title);
  //   assert.equal(title?.innerText, 'It sets the title');
  //   assert.equal(document.title, 'It sets the title');

  //   assert.equal(document.querySelector('h1')!.innerText, 'Hello world');

  //   await runWithDefer(async (defer) => {
  //     const server = await createServer({
  //       base: '/',
  //     });
  //     defer(() => server.close());

  //     global.window = window;
  //     global.document = document;
  //     defer(() => {
  //       //@ts-ignore
  //       delete global.window;
  //       //@ts-ignore
  //       delete global.document;
  //     });

  //     const { ClientRenderer } = (await server.ssrLoadModule(
  //       `${__dirname}/bootstrap.tsx`
  //     )) as typeof import('./clientRenderer');

  //     const renderer = new ClientRenderer({
  //       appRoot,
  //       lazyComponents: [],
  //       publicUrl: '/',
  //     });

  //     await ReactTestUtils.act(async () => {
  //       await renderer.render();
  //     });

  //     // Confirm that initial hydration worked
  //     assert.equal(document.querySelector('h1')!.innerText, 'Goodnight moon');
  //   });
  // });
});

function describe(title: string, def: (it: Test) => void) {
  const it = suite(title);

  def(it);

  it.run();
}
