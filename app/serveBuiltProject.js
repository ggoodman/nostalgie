//@ts-check

const Fastify = require('fastify');
const Pino = require('pino');
const Path = require('node:path');
const Piscina = require('piscina');
const { Headers } = require('headers-utils');

/** @type {import('node:cluster').default} */
//@ts-ignore
const Cluster = require('node:cluster');
const Os = require('node:os');

const Nostalgie = require('./out/nostalgie.server');

if (false && Cluster.isPrimary) {
} else {
  const pool = new Piscina({
    filename: __dirname + '/out/nostalgie.server.js',
    name: 'render',
  });

  const server = Fastify.fastify({
    logger: Pino.pino(),
  });

  server.register(require('fastify-compress').default);

  server.register(require('fastify-static').default, {
    root: Path.join(__dirname, './out/assets'),
    prefix: '/assets/', // optional: default '/'
  });

  server.get('/robots.txt', async (req, reply) => {
    return reply.code(200).type('text/plain').send('');
  });

  /** @type {typeof import('./out/nostalgie.server').render} */
  const renderWithPiscina = async (req) => {
    /** @type {Awaited<ReturnType<typeof import('./out/nostalgie.server').render>>} */
    const result = await pool.run(req);

    result.response.headers = new Headers(result.response.headers._headers);

    return result;
  };

  server.get('/*', async (req, reply) => {
    const { response, errors, stats } = await renderWithPiscina({
      method: req.method,
      headers: req.headers,
      path: req.url,
    });

    req.log.info({ errors, stats }, 'ssr completed');

    return reply
      .code(response.status)
      .headers(Object.fromEntries(response.headers))
      .send(response.body);
  });

  server.listen(3000);
}
