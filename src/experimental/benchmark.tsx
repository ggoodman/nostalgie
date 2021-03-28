import { add, complete, cycle, suite } from 'benny';
import { Headers } from 'headers-utils/lib';
import * as React from 'react';
import { dataPlugin } from './data/plugin';
import { htmlPlugin } from './html/plugin';
import { ServerRenderer } from './serverRenderer';

// const templateHtml = `<!DOCTYPE html><html><head></head><body></body></html>`;

suite(
  'ServerRenderer',
  add('Basic operation', () => {
    const renderer = new ServerRenderer({
      appRoot: () => <h1>Hello world</h1>,
      chunkDependencies: {},
      entrypointUrl: '/',
      plugins: [htmlPlugin(), dataPlugin()],
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

// suite(
//   'HTML parse and serialize',
//   add('node-html-parser parse / toString', () => {
//     return () => {
//       const template = parse(templateHtml, {
//         blockTextElements: {
//           script: true,
//           noscript: true,
//           style: true,
//           pre: true,
//         },
//       });

//       if (template.toString() !== templateHtml) {
//         throw new Error('Mismatch');
//       }
//     };
//   }),
//   add('linkedom cloneNode(true) / toString', () => {
//     const { document } = parseHTML(templateHtml);

//     return () => {
//       const inst = document.cloneNode(true) as Document;

//       if (inst.toString() !== templateHtml) {
//         throw new Error('Mismatch');
//       }
//     };
//   }),
//   add('linkedom parseHtml / toString', () => {
//     return () => {
//       const { document } = parseHTML(templateHtml);

//       if (document.toString() !== templateHtml) {
//         throw new Error('Mismatch');
//       }
//     };
//   }),
//   add('linkedom toJSON / parseJSON', () => {
//     const { document } = parseHTML(templateHtml);
//     //@ts-ignore
//     const arr = document.toJSON();

//     return () => {
//       const doc = parseJSON(arr);
//       if (doc.toString() !== templateHtml) {
//         console.log(doc.toString());
//         throw new Error('Mismatch');
//       }
//     };
//   }),
//   cycle(),
//   complete()
// );
