import type { Plugin, Service } from 'esbuild';
import got from 'got';
// import * as Url from 'url';
import * as Path from 'path';
import type { NostalgieSettings } from '../../settings';

export function cssBrowserPlugin(
  settings: NostalgieSettings,
  service: Service,
  cssMap: Map<string, string>
): Plugin {
  return {
    name: 'css',
    setup(build) {
      const googleFontRx = /^https:\/\/(fonts\.gstatic\.com|.*\.(eot|woff|woff2|ttf)(?:#.*)?$)/;

      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        const cssBundle = await service.build({
          bundle: true,
          entryPoints: [path],
          logLevel: 'error',
          minify: true,
          treeShaking: true,
          write: false,
          plugins: [
            {
              name: 'font-urls',
              setup: (build) => {
                build.onLoad({ filter: googleFontRx }, async ({ path }) => {
                  const res = await got.get(path, {
                    responseType: 'buffer',
                  });

                  return {
                    contents: res.body,
                    loader: 'base64',
                  };
                });
              },
            },
            {
              name: 'font-files',
              setup: (build) => {
                build.onLoad(
                  { filter: /^\.(eot|woff|woff2|ttf)(?:#.*)?$/, namespace: 'file' },
                  async () => {
                    return {
                      loader: 'base64',
                    };
                  }
                );
              },
            },
            {
              name: 'css-imports',
              setup: (build) => {
                const namespace = 'css-imports';
                build.onResolve({ filter: /^https?:\/\// }, ({ importer, path }) => {
                  return {
                    namespace,
                    path,
                  };
                });

                build.onLoad({ filter: /.*/, namespace }, async ({ path }) => {
                  const res = await got.get(path, {
                    responseType: 'text',
                  });

                  return {
                    contents: res.body,
                    loader: 'css',
                  };
                });
              },
            },
          ],
        });
        // We don't want to leak the full path into production bundles.
        const relPath = Path.relative(settings.rootDir, path);
        const css = cssBundle.outputFiles[0].text.trim();

        cssMap.set(relPath, css);

        return {
          contents:
            `
if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
  if (!document.querySelector(\`style[data-ns-css=${JSON.stringify(relPath)}]\`)) {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(css)};
    style.dataset.nsCss = ${JSON.stringify(relPath)};
    document.head.appendChild(style);
  }
}
            `.trim() + '\n',
          loader: 'js',
        };
      });
    },
  };
}

export function cssServerPlugin(
  settings: NostalgieSettings,
  service: Service,
  cssMap: Map<string, string>
): Plugin {
  return {
    name: 'css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        const cssBundle = await service.build({
          bundle: true,
          entryPoints: [path],
          logLevel: 'error',
          minify: true,
          treeShaking: true,
          write: false,
        });
        // We don't want to leak the full path into production bundles.
        const relPath = Path.relative(settings.rootDir, path);
        const css = cssBundle.outputFiles[0].text.trim();

        cssMap.set(relPath, css);

        return {
          contents: 'module.exports = undefined;',
          loader: 'js',
        };
      });
    },
  };
}
