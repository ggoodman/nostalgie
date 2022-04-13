//@ts-check
const { render } = require('./out/nostalgie.server');

const fastify = require('fastify');
const path = require('path');

const server = fastify.fastify();

server.register(require('fastify-static').default, {
  root: path.join(__dirname, './out/assets'),
  prefix: '/assets/', // optional: default '/'
});

server.get('/robots.txt', async (req, reply) => {
  return reply.code(200).type('text/plain').send('');
});

server.get('/*', async (req, reply) => {
  const { response } = await render({
    method: req.method,
    headers: req.headers,
    path: req.url,
  });

  return reply
    .code(response.status)
    .headers(Object.fromEntries(response.headers))
    .send(response.body);
});

server.listen(3000);
