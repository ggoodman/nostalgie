//@ts-check
const { render } = require('./out/ssr/nostalgie.js');

render({
  path: '/',
  method: 'get',
  headers: {},
  body: undefined,
}).then(console.dir, console.error);
