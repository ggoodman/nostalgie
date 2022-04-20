import Debug from 'debug';
import { readdir, stat } from 'fs/promises';
import { join, relative, resolve } from 'path';
import type { NostalgieConfig } from '../../../config';
import { invariant } from '../../../invariant';
import type { Plugin } from '../../../plugin';
import { lazyPlugin } from '../lazy/plugin';

const debug = Debug.debug('nostalgie:plugin:routing');

interface RouteObject {
  caseSensitive?: boolean;
  children?: RouteObject[];
  element?: React.ReactNode;
  index?: boolean;
  path?: string;
}

export interface RoutingPluginOptions {
  extensions?: string[];
}

export function routingPlugin(options: RoutingPluginOptions = {}): Plugin {
  let config: NostalgieConfig;
  const extensions = options.extensions ?? ['js', 'jsx', 'ts', 'tsx', 'mdx'];

  const prefix = 'nostalgie-routes:';

  return {
    name: 'plugin-routing',
    enforce: 'pre',
    getClientRendererPlugins() {
      return {
        config: options,
        spec: 'nostalgie/plugins/routing/client',
      };
    },

    getServerRendererPlugins() {
      return {
        config: options,
        spec: 'nostalgie/plugins/routing/server',
      };
    },

    config(config) {
      // See: https://vitejs.dev/config/#ssr-options
      (config as any).ssr ??= {};
      (config as any).ssr.noExternal ??= [];
      (config as any).ssr.noExternal.push('react-router');
      (config as any).ssr.noExternal.push('react-router-dom');
    },

    nostalgieConfig(viteConfig, config) {
      config.settings.plugins ??= [];
      if (
        !config.settings.plugins.some((plugin) => plugin.name === 'plugin-lazy')
      ) {
        config.settings.plugins.push(lazyPlugin());
      }

      if (!config.settings.appEntrypoint?.startsWith(prefix)) {
        config.settings.appEntrypoint = `${prefix}${config.settings.appEntrypoint}`;

        debug('Updated app entrypoint to: %s', config.settings.appEntrypoint);
      }
    },
    nostalgieConfigResolved(_config) {
      config = _config;
    },
    async resolveId(source, importer) {
      if (!source.startsWith(prefix)) {
        return;
      }

      invariant(config, 'Config must be resolved');
      const routeSpec = source.slice(prefix.length);
      const routesInfo = await this.resolve(routeSpec, importer, {
        skipSelf: true,
      });

      if (!routesInfo?.id) {
        throw new Error(
          `When using 'nostalgie/routing', the entrypoint must point to the root layout componenent. You specified ${JSON.stringify(
            routeSpec
          )}. The 'routes' directory should be adjacent to that file.`
        );
      }

      debug('Found entrypoint for routing: %s', routesInfo.id);

      return `${prefix}${routesInfo.id}`;
    },
    async load(id) {
      if (!id.startsWith(prefix)) {
        return;
      }

      invariant(config, 'Config must be resolved');

      const rootRel = (path: string): string =>
        `./${relative(config.rootDir, path)}`;

      debug('Handling routing entrypoint: %s', id);

      const rootLayoutPath = id.slice(prefix.length);

      this.addWatchFile(rootLayoutPath);

      debug('Found root layout: %s', rootRel(rootLayoutPath));

      const routesPath = resolve(rootLayoutPath, '../routes');

      try {
        const routesStat = await stat(routesPath);

        if (!routesStat.isDirectory()) {
          throw new Error(`Not a directory`);
        }
      } catch (err) {
        this.error(
          `When using 'nostalgie/routing', the 'routes' directory must be adjacent to your root layout (${JSON.stringify(
            rootRel(routesPath)
          )}). Error: ${err}`
        );
      }

      debug('Found routes directory: %s', rootRel(routesPath));

      // TODO: Make this configurable
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mdx'];

      class RouteEntry {
        readonly children?: RouteEntry[];
        readonly lazyPath?: string;
        readonly index?: boolean;
        readonly path?: string;

        constructor(options: {
          children?: RouteEntry[];
          lazyPath?: string;
          index?: boolean;
          path?: string;
        }) {
          this.children = options.children;
          this.lazyPath = options.lazyPath;
          this.index = options.index;
          this.path = options.path;
        }

        toJavaScript(): string {
          const lines: string[] = [];

          if (this.children?.length) {
            lines.push(
              `children: [${this.children
                .map((child) => child.toJavaScript())
                .join(',\n')}]`
            );
          }

          if (this.index) {
            lines.push('index: true');
          }

          if (this.lazyPath) {
            lines.push(
              `element: createRoute(createLazy(() => import(${JSON.stringify(
                this.lazyPath
              )})))`
            );
          }

          if (this.path) {
            lines.push(`path: ${JSON.stringify(this.path)}`);
          }

          return `{
            ${lines.join(',\n')}
          }`;
        }
      }

      const processPath = async (
        path: string,
        history: string[]
      ): Promise<RouteEntry[]> => {
        const dirents = await readdir(path, { withFileTypes: true });
        const entries: RouteEntry[] = [];

        const dirs = new Set(
          dirents
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
        );
        const files = new Set(
          dirents
            .filter((dirent) => dirent.isFile())
            .map((dirent) => dirent.name)
        );

        for (const dirname of dirs) {
          let layoutPath: string | undefined = undefined;

          for (const ext of extensions) {
            const candidate = `${dirname}${ext}`;

            if (files.has(candidate)) {
              const layoutPathname = join(path, candidate);

              layoutPath = layoutPathname;

              this.addWatchFile(layoutPathname);

              // Don't process the layout after
              files.delete(candidate);
            }
          }

          const children = await processPath(join(path, dirname), [
            ...history,
            dirname,
          ]);

          entries.push(
            new RouteEntry({
              children,
              index: false,
              lazyPath: layoutPath,
              path: mapFileToRoute(dirname, history),
            })
          );
        }

        for (const filename of files) {
          const pathname = join(path, filename);
          const index = extensions.some((ext) => filename === `index${ext}`);

          entries.push(
            new RouteEntry({
              index,
              lazyPath: pathname,
              path: index ? undefined : mapFileToRoute(filename, history),
            })
          );

          this.addWatchFile(pathname);
        }

        return entries;
      };

      const children = await processPath(routesPath, []);
      const rootEntry = new RouteEntry({
        children,
        index: false,
        lazyPath: rootLayoutPath,
        path: '/',
      });
      const routesCode = `[${rootEntry.toJavaScript()}]`;

      debug('Finished discovering pages');

      const prelude = `
        import { useRoutes } from 'react-router-dom';
        import { createLazy } from 'nostalgie/lazy';
        import { createRoute } from 'nostalgie/routing';
      `;

      const code = `
        ${prelude};

        export default function() {
          const el = useRoutes(${routesCode});

          return el;
        }
      `;

      return { code };
    },
  };

  function mapFileToRoute(path: string, history: string[]): string {
    const extensionsRegExp = new RegExp(`\\.(${extensions.join('|')})$`);
    const paramRegExp = new RegExp(`(^|/)\\$(\\w+)(/|$)`);

    return path
      .replace(extensionsRegExp, '')
      .replace(paramRegExp, (_, pre, param, post) => {
        return `${pre}:${param}${post}`;
      });
  }
}
