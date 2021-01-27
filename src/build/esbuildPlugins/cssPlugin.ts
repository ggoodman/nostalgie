import type { Plugin, Service } from 'esbuild';
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
