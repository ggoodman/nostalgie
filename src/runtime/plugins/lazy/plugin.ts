import Debug from 'debug';
import jsesc from 'jsesc';
import MagicString from 'magic-string';
import * as Path from 'node:path';
import type { ResolvedConfig } from 'vite';
import { invariant } from '../../../invariant';
import type { Plugin } from '../../../plugin';

const debug = Debug.debug('nostalgie:plugin:lazy');
// const preloadMethod = `__vitePreload`

export const pluginName = 'nostalgie-plugin-lazy';

export function lazyPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined = undefined;
  let counter = 0;

  return {
    name: pluginName,
    enforce: 'post',
    getClientRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/plugins/lazy/client',
      };
    },
    getServerRendererPlugins() {
      return {
        config: {},
        spec: 'nostalgie/plugins/lazy/server',
      };
    },
    configResolved(config) {
      resolvedConfig = config;
    },

    options(inputOptions) {
      return null;
    },

    async transform(code, id, options) {
      if (id.includes('/node_modules/')) {
        return null;
      }

      invariant(resolvedConfig, `Resolved config not available`);

      const isSync = !!options?.ssr;
      const s = new MagicString(code, {
        filename: id,
        indentExclusionRanges: [],
      });

      const deferredImportRx = /\(\)\s*=>\s*import\(\s*(['"])([^)]+)\1\s*\)/gm;
      let matched = false;

      if (id === '/routes:./src/pages') {
        console.log('transform', id, code);
      }

      for (
        let res = deferredImportRx.exec(code);
        res != null;
        res = deferredImportRx.exec(code)
      ) {
        const [match, , spec] = res;
        const ss = res.index;
        const se = ss + match.length;

        matched = true;

        const target = await this.resolve(spec, id, {
          skipSelf: true,
        });
        if (!target) {
          this.warn(
            `Error resolving the target of the dynamic import ${JSON.stringify(
              spec
            )} while trying to annotate it`,
            ss
          );

          continue;
        }
        const rootRelativePath = Path.relative(resolvedConfig.root, target.id);
        const importerRelativePath = Path.relative(Path.dirname(id), target.id);

        // Location where the client can load a lazy import
        let fileRef: string = jsesc(`/${rootRelativePath}`, {
          isScriptContext: true,
          json: true,
        });

        debug(
          'Overwriting deferred import %s, of %s in %s',
          match,
          fileRef,
          id
        );

        const lazyMeta = {
          id: rootRelativePath,
          // Convert false to undefined so that stringification will skip
          // the field.
          sync: isSync || undefined,
        };

        s.prependLeft(ss, 'Object.defineProperty(');
        s.appendRight(
          se,
          `, Symbol.for('nostalgie.id'), { configurable: true, value: ${JSON.stringify(
            lazyMeta
          )}})`
        );

        const symbolName = `__nostalgie_lazy_${counter++}`;

        if (isSync) {
          // Convert a dynamic import into a synchronous require
          s.prepend(
            `import ${symbolName} from ${jsesc(`./${importerRelativePath}`, {
              isScriptContext: true,
              json: true,
            })};\n`
          );
          s.overwrite(ss, se, `() => ({ default: ${symbolName} })`);
        } else if (resolvedConfig.command === 'build') {
          s.overwrite(ss, se, `() => import(${fileRef})`);
        }
      }

      if (!matched) {
        return null;
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
    resolveFileUrl(options) {
      if (options.format === 'cjs') {
        return null;
      }
      return JSON.stringify(options.fileName);
    },
  };
}
