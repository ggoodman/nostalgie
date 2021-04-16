import reactRefreshPlugin from '@vitejs/plugin-react-refresh';
import { Headers } from 'headers-utils/lib';
import * as Http from 'http';
import * as Path from 'path';
import { createServer } from 'vite';
import { htmlPlugin } from './html/plugin';
import type { RootComponent } from './serverRenderer';
import { vitePlugin } from './vite/plugin';

///<reference lib="dom" />
///<reference lib="dom.iterable" />

async function main() {
  const server = await createServer({
    configFile: false,
    logLevel: 'info',
    build: {
      manifest: true,
      rollupOptions: {
        input: '@@nostalgie@@',
      },
      sourcemap: true,
    },
    server: {
      middlewareMode: true,
      hmr: true,
    },
    // optimizeDeps: {
    //   include: [require.resolve('react')],
    // },
    // root: Path.resolve(__dirname, '../'),
    // build: {
    //   rollupOptions: {
    //     input: '@@nostalgie@@',
    //   },
    // },
    plugins: [
      reactRefreshPlugin(),
      {
        name: 'nostalgie-entrypoint',
        resolveId(source, importer, options, isSSR) {
          if (source === '/.nostalgie/main.js') {
            return Path.resolve(__dirname, '@@nostalgie@@');
          }
          if (source === '@@nostalgie@@' || source === '/main.js') {
            return {
              id: '@@nostalgie@@',
            };
          }

          return;
        },
        load(id, isSSR) {
          const serverCode = `
            import { ServerRenderer } from ${JSON.stringify(
              Path.resolve(__dirname, './serverRenderer.tsx')
            )};
            import { vitePlugin } from ${JSON.stringify(
              Path.resolve(__dirname, './vite/plugin.ts')
            )};
            import { twindPlugin } from ${JSON.stringify(
              Path.resolve(__dirname, './twind/plugin.ts')
            )};
            import App from ${JSON.stringify(Path.resolve(__dirname, './app'))};
            
            export const renderer = new ServerRenderer({
              appRoot: App,
              chunkDependencies: {},
              entrypointUrl: "http://localhost:3000/main.js",
              plugins: [
                twindPlugin(),
                vitePlugin(),
              ],
            });
            `;

          const clientCode = `
            // import 'vite/dynamic-import-polyfill';
            import { ClientRenderer } from ${JSON.stringify(
              Path.resolve(__dirname, './clientRenderer.tsx')
            )};
              import App from ${JSON.stringify(Path.resolve(__dirname, './app'))};
              
              export const renderer = new ClientRenderer({
                appRoot: App,
                chunkDependencies: {},
                entrypointUrl: "http://localhost:3000/main.js",
              });
              `;

          if (!id.endsWith('@@nostalgie@@')) {
            return;
          }

          return {
            code: isSSR ? serverCode : clientCode,
          };
        },
      },
    ],
  });

  const httpServer = Http.createServer(async (req, res) => {
    const appRootDir = Path.resolve(__dirname, './app');

    const { default: config } = (await server.ssrLoadModule(
      Path.resolve(appRootDir, './nostalgie.config')
    )) as typeof import('./app/nostalgie.config');
    const { ServerRenderer } = (await server.ssrLoadModule(
      './serverRenderer'
    )) as typeof import('./serverRenderer');
    const { default: appRootComponent } = (await server.ssrLoadModule(
      Path.resolve(appRootDir, config.appEntrypoint)
    )) as { default: RootComponent };

    const renderer = new ServerRenderer({
      appRoot: appRootComponent,
      appRootUrl: `/${Path.relative(__dirname, Path.resolve(appRootDir, config.appEntrypoint))}`,
      entrypointUrl: '/clientRenderer.tsx',
      plugins: [vitePlugin(), htmlPlugin(), ...(config.plugins || [])],
    });

    if (req.method?.toLowerCase() === 'get' && req.url === '/') {
      const { response } = await renderer.render({
        body: '',
        headers: new Headers(),
        method: 'get',
        path: '/',
      });
      const html = response.body;
      const headers: Http.OutgoingHttpHeaders = {};

      response.headers.forEach((v, k) => (headers[k] = v));

      res.writeHead(response.status, response.statusText, headers);
      res.end(html);
      return;
    }

    server.middlewares(req, res, (err: Error) => {
      if (err) {
        console.error(err);

        if (!res.headersSent) {
          res.writeHead(500, {
            'content-type': 'text/plain',
          });
          res.end();
          return;
        }
      }

      if (!res.headersSent) {
        res.writeHead(404, {
          'content-type': 'text/plain',
        });
        res.end();
        return;
      }
    });

    // const url = Url.parse(req.url || '/');
    // const transformedRequest = await server.transformRequest(req.url!, { ssr: false });

    // if (transformedRequest) {
    //   const mime = mimos.path(url.pathname || '/');
    //   res.writeHead(200, {
    //     'content-type': mime.type || 'application/octet-stream',
    //     etag: (transformedRequest as any).etag,
    //   });
    //   res.end((transformedRequest as any).code);
    //   return;
    // }

    // res.writeHead(404, {
    //   'content-type': 'text/plain',
    // });
    // res.end();

    // console.log('oops', transformedRequest);
  });

  httpServer.listen(3000);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
