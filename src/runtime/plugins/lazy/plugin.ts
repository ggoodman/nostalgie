import Debug from 'debug';
import jsesc from 'jsesc';
import MagicString from 'magic-string';
import * as Path from 'path';
import type { InputOptions } from 'rollup';
import type { ResolvedConfig } from 'vite';
import { invariant } from '../../../invariant';
import type { Plugin } from '../../../plugin';

const debug = Debug.debug('nostalgie:plugin:lazy');
// const preloadMethod = `__vitePreload`

export function lazyPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined = undefined;
  let resolvedInputOptions: InputOptions | undefined = undefined;
  let counter = 0;

  return {
    name: 'lazy-plugin',
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
      resolvedInputOptions = inputOptions;
      return null;
    },

    async transform(code, id, ssr) {
      if (id.includes('/node_modules/')) {
        return null;
      }

      invariant(resolvedConfig, `Resolved config not available`);
      invariant(resolvedInputOptions, `Resolved input options not available`);

      const s = new MagicString(code, {
        filename: id,
        indentExclusionRanges: [],
      });

      const deferredImportRx = /\(\)\s*=>\s*import\(\s*(['"])([^)]+)\1\s*\)/gm;
      let matched = false;

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

        let moduleId = target.id;

        if (resolvedConfig.command === 'build') {
          const fileReferenceId = this.emitFile({
            type: 'chunk',
            id: target.id,
            importer: id,
          });
          moduleId = `import.meta.ROLLUP_FILE_URL_${fileReferenceId}`;
        }

        const rootRelativePath = Path.relative(resolvedConfig.root, target.id);
        const importerRelativePath = Path.relative(Path.dirname(id), target.id);

        debug('Overwriting deferred import %s in %s', match, id);

        s.prependLeft(ss, 'Object.defineProperty(');
        s.appendRight(
          se,
          `, Symbol.for('nostalgie.id'), { configurable: true, value: { chunkId: ${jsesc(
            `/${rootRelativePath}`,
            { isScriptContext: true, json: true }
          )}, sync: ${JSON.stringify(ssr)} }})`
        );

        const symbolName = `__nostalgie_lazy_${counter++}`;

        if (ssr) {
          // Convert a dynamic import into a synchronous require
          s.prepend(
            `import ${symbolName} from ${jsesc(`./${importerRelativePath}`, {
              isScriptContext: true,
              json: true,
            })};\n`
          );
          s.overwrite(ss, se, `() => ({ default: ${symbolName} })`);
        } else if (resolvedConfig.command === 'build') {
          s.overwrite(ss, se, `() => import(${moduleId})`);
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
  };
}
