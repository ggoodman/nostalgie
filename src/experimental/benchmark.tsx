import { add, complete, cycle, suite } from 'benny';
import { Headers } from 'headers-utils/lib';
import { parseHTML, parseJSON } from 'linkedom';
import { parse } from 'node-html-parser';
import * as React from 'react';
import { defaultMarkupProps } from '../runtime/markup';
import { helmetPlugin } from './plugins/helmetPlugin';
import { reactQueryPlugin } from './plugins/reactQueryPlugin';
import { ServerRenderer } from './serverRenderer';

const templateHtml = `<!DOCTYPE html><html><head></head><body></body></html>`;

suite(
  'ServerRenderer',
  add('Basic operation', () => {
    const renderer = new ServerRenderer({
      appRoot: () => <h1>Hello world</h1>,
      chunkDependencies: {},
      plugins: [helmetPlugin(defaultMarkupProps), reactQueryPlugin()],
    });

    async () => {
      await renderer.render({
        body: '',
        headers: new Headers(),
        method: 'get',
        path: '/',
      });
    };
  }),
  cycle(),
  complete()
);

suite(
  'HTML parse and serialize',
  add('node-html-parser parse / toString', () => {
    return () => {
      const template = parse(templateHtml, {
        blockTextElements: {
          script: true,
          noscript: true,
          style: true,
          pre: true,
        },
      });

      if (template.toString() !== templateHtml) {
        throw new Error('Mismatch');
      }
    };
  }),
  add('linkedom cloneNode(true) / toString', () => {
    const { document } = parseHTML(templateHtml);

    return () => {
      const inst = document.cloneNode(true) as Document;

      if (inst.toString() !== templateHtml) {
        throw new Error('Mismatch');
      }
    };
  }),
  add('linkedom parseHtml / toString', () => {
    return () => {
      const { document } = parseHTML(templateHtml);

      if (document.toString() !== templateHtml) {
        throw new Error('Mismatch');
      }
    };
  }),
  add('linkedom toJSON / parseJSON', () => {
    const { document } = parseHTML(templateHtml);
    //@ts-ignore
    const arr = document.toJSON();

    return () => {
      const doc = parseJSON(arr);
      if (doc.toString() !== templateHtml) {
        console.log(doc.toString());
        throw new Error('Mismatch');
      }
    };
  }),
  cycle(),
  complete()
);
