import Debug from 'debug';
import escapeStringRegexp from 'escape-string-regexp';
import { readdir, stat } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { DEFAULT_EXTENSIONS } from '../../../constants';
import type { Plugin } from '../../../plugin';
import * as LazyPlugin from '../../lazy/plugin/lazyPlugin';

const debug = Debug.debug('nostalgie:plugin:routing');

export const pluginName = 'nostalgie-plugin-routing';

export interface RoutingPluginOptions {
  routesPath: string;
}

export function routingPlugin(options: RoutingPluginOptions): Plugin {
  const prefix = 'nostalgie-routes:';

  return {
    name: pluginName,
    enforce: 'pre',
    preconfigure(nostalgieConfig, viteConfig) {
      viteConfig.plugins ??= [];

      // Make sure the lazy plugin is requested
      if (
        !viteConfig.plugins
          .flat()
          .some((plugin) => plugin && plugin.name === LazyPlugin.pluginName)
      ) {
        viteConfig.plugins.push(LazyPlugin.lazyPlugin());
      }

      if (!nostalgieConfig.appEntrypoint?.startsWith(prefix)) {
        nostalgieConfig.appEntrypoint = `${prefix}${nostalgieConfig.appEntrypoint}`;

        debug('Updated app entrypoint to: %s', nostalgieConfig.appEntrypoint);
      }

      (viteConfig as any).ssr ??= {};
      (viteConfig as any).ssr.noExternal ??= [];
      (viteConfig as any).ssr.noExternal.push('react-router');
      (viteConfig as any).ssr.noExternal.push('react-router-dom');
    },

    configResolved(config) {
      const extensions = config.resolve.extensions ?? DEFAULT_EXTENSIONS;

      this.getClientRendererPlugins = () => {
        return {
          config: options,
          spec: 'nostalgie/routing/plugin/client',
        };
      };

      this.getServerRendererPlugins = () => {
        return {
          config: options,
          spec: 'nostalgie/routing/plugin/server',
        };
      };

      this.resolveId = async function (source, importer) {
        if (!source.startsWith(prefix)) {
          return;
        }

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
      };

      this.load = async function load(id) {
        if (!id.startsWith(prefix)) {
          return;
        }

        const rootRel = (path: string): string =>
          `./${relative(config.root, path)}`;

        debug('Handling routing entrypoint: %s', id);

        const rootLayoutPath = id.slice(prefix.length);

        this.addWatchFile(rootLayoutPath);

        debug('Found root layout: %s', rootRel(rootLayoutPath));

        const routesPath = resolve(config.root, options.routesPath);

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

                const layoutInfo = await this.resolve(
                  layoutPathname,
                  config.root,
                  {
                    skipSelf: true,
                  }
                );
                if (layoutInfo && !layoutInfo.external) {
                  layoutPath = layoutPathname;

                  this.addWatchFile(layoutPathname);

                  // Don't process the layout after
                  files.delete(candidate);
                }
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
                path: mapFileToRoute(dirname, extensions, history),
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
                path: index
                  ? undefined
                  : mapFileToRoute(filename, extensions, history),
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

        return { code, map: { mappings: '' } };
      };
    },
  };
}

function mapFileToRoute(
  path: string,
  extensions: string[],
  history: string[]
): string {
  const extensionsRegExp = new RegExp(
    `(${extensions.map(escapeStringRegexp).join('|')})$`
  );
  const paramRegExp = new RegExp(`(^|/)\\$(\\w+)(/|$)`);

  return path
    .replace(extensionsRegExp, '')
    .replace(paramRegExp, (_, pre, param, post) => {
      return `${pre}:${param}${post}`;
    });
}
