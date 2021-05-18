import Debug from 'debug';
import MagicString from 'magic-string';
import * as Path from 'path';
import type { InputOptions } from 'rollup';
import type { ResolvedConfig } from 'vite';
import { invariant } from '../../../invariant';
import type { Plugin } from '../../../plugin';

const debug = Debug.debug('nostalgie:plugin:lazy');

export function lazyPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined = undefined;
  let resolvedInputOptions: InputOptions | undefined = undefined;
  let counter = 0;

  return {
    name: 'lazy-plugin',
    enforce: 'pre',
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

    // renderDynamicImport(options) {
    //   return {
    //     left: `Object.defineProperty(require(`,
    //     right: `), Symbol.for('nostalgie.id'), { chunkId: ${JSON.stringify(
    //       options.targetModuleId
    //     )}, sync: true }))`,
    //   };
    // },

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

        const chunkId = JSON.stringify(
          resolvedConfig.command === 'build'
            ? `__VITE_ASSET__${this.emitFile({
                type: 'chunk',
                id: target.id,
                importer: id,
              })}__`
            : `/${Path.relative(resolvedConfig.root, target.id)}`
        );

        debug('Overwriting deferred import %s in %s', match, id);

        s.prependLeft(ss, 'Object.defineProperty(');
        s.appendRight(
          se,
          `, Symbol.for('nostalgie.id'), { configurable: true, value: { chunkId: ${chunkId}, sync: ${JSON.stringify(
            ssr
          )} }})`
        );

        const symbolName = `__nostalgie_lazy_${counter++}`;

        if (ssr) {
          // Convert a dynamic import into a synchronous require
          s.prepend(`import ${symbolName} from ${JSON.stringify(spec)};\n`);
          s.overwrite(ss, se, `() => ({ default: ${symbolName} })`);
        } else if (resolvedConfig.command === 'build') {
          s.overwrite(ss, se, `() => import(${JSON.stringify(chunkId)})`);
        }
      }

      if (!matched) {
        return null;
      }

      // code.replace(
      //   deferredImportRx,
      //   (match: string, _quote: string, spec: string) => {
      //     debug('transform(%s, %j): %s', id, ssr, match);
      //     return match;
      //   }
      // );

      // const transformed = await transform(code, {
      //   format: 'esm',
      //   sourcemap: true,
      //   target: 'es2020',
      // });

      // await Lexer.init;

      // const [imports] = Lexer.parse(code, id);

      // const dynamicImports = imports.filter((i) => i.d >= 0);

      // if (!dynamicImports.length) {
      //   return null;
      // }

      // invariant(resolvedConfig, `Resolved config not available`);
      // invariant(resolvedInputOptions, `Resolved input options not available`);

      // debug('Identified imports', dynamicImports);

      // for (const importRecord of dynamicImports) {
      //   if (!importRecord.n) {
      //     this.warn(
      //       `Unable to annotate lazy imports for dynamic resources`,
      //       importRecord.s
      //     );
      //     continue;
      //   }

      //   const ss = importRecord.ss;
      //   const se = importRecord.se || importRecord.e;

      //   const target = await this.resolve(importRecord.n, id, {
      //     skipSelf: true,
      //   });
      //   if (!target) {
      //     this.warn(
      //       `Error resolving the target of the dynamic import ${JSON.stringify(
      //         importRecord.n
      //       )} while trying to annotate it`,
      //       importRecord.s
      //     );
      //     continue;
      //   }

      //   const chunkId = JSON.stringify(
      //     resolvedConfig.command === 'build'
      //       ? `__VITE_ASSET__${this.emitFile({
      //           type: 'chunk',
      //           id: target.id,
      //           importer: id,
      //         })}__`
      //       : `${target.id}`
      //   );

      //   s.prependLeft(ss, 'Object.defineProperty(');
      //   s.appendRight(
      //     se + 1,
      //     `, Symbol.for('nostalgie.id'), { value: { chunkId: ${chunkId}, sync: ${JSON.stringify(
      //       ssr
      //     )} }})`
      //   );

      //   if (ssr) {
      //     // Convert a dynamic import into a synchronous require
      //     s.prepend(
      //       `import Module from 'module'; const require = Module.createRequire(import.meta.url);\n`
      //     );
      //     s.overwrite(ss, se + 1, `require(${JSON.stringify(importRecord.n)})`);
      //   } else if (resolvedConfig.command === 'build') {
      //     // s.overwrite(importRecord.s, importRecord.e, `${chunkId}`);
      //   }
      // }

      // console.log(s.toString());
      // console.log({ ssr, command: resolvedConfig.command });

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
  //       buildStart: async () => {
  //         await Lexer.init;
  //       },
  //       async transform(code, id, ssr) {
  //         debug('transform(%s, %j)', id, ssr);

  //         if (!code.includes('react') || id.endsWith('?lazyShim')) {
  //           return null;
  //         }

  //         const [imports] = Lexer.parse(code, id);
  //         const s = new MagicString(code, {
  //           filename: id,
  //           indentExclusionRanges: [],
  //         });

  //         for (const importRecord of imports) {
  //           if (importRecord.n === 'react') {
  //             s.overwrite(importRecord.s, importRecord.e, `react?lazyShim`);
  //             debug('overriding react in %s', id);
  //           }
  //         }

  //         return {
  //           code: s.toString(),
  //           map: s.generateMap({ hires: true }),
  //         };
  //       },
  //       async resolveId(source, importer, options, ssr) {
  //         if (importer && source.endsWith('?lazyShim')) {
  //           debug('resolveId(%s, %s, %j)', source, importer, ssr);
  //           if (!reactExports.length) {
  //             const require = createRequire(importer);
  //             const react = require('react');
  //             const nostalgieLazy = await this.resolve(
  //               'nostalgie/lazy',
  //               importer,
  //               {
  //                 skipSelf: true,
  //               }
  //             );

  //             invariant(react, 'Failed to resolve react');
  //             invariant(nostalgieLazy, 'Failed to resolve nostalgie/lazy');

  //             reactExports.push(...Object.keys(react));

  //             // lazyPath = nostalgieLazy.id;
  //           }

  //           return {
  //             id: source,
  //           };
  //         }
  //       },
  //     },
  //     {
  //       name: 'lazy-plugin-runtime',
  //       enforce: 'pre',
  //       async load(id, ssr) {
  //         debug('load(%s, %j)', id, ssr);

  //         if (id.endsWith('?lazyShim')) {
  //           const reactShims: Record<string, string> = {
  //             Suspense: ssr
  //               ? '({children}) => React.createElement(React.Fragment, {children})'
  //               : 'React.Suspense',
  //             lazy: 'nostalgieLazy',
  //           };

  //           for (const exportName of reactExports) {
  //             if (!(exportName in reactShims)) {
  //               reactShims[exportName] = `React.${exportName}`;
  //             }
  //           }

  //           const reExports = Object.keys(reactShims)
  //             .map(
  //               (exportName) =>
  //                 `export const ${exportName} = ${reactShims[exportName]};`
  //             )
  //             .join('\n');

  //           return {
  //             code: `
  // import * as React from "react";

  // function nostalgieLazy(factory) {
  //   return function LazyComponent(props) {
  //     return null;
  //     const [settledValue, setSettledValue] = React.useState({type: "idle", value: factory});
  //     console.log(settledValue);
  //     React.useEffect(() => {
  //       if (settledValue.type === "idle") {
  //         debugger;
  //         const promise = settledValue.value();
  //         promise.then((result) => {
  //           debugger;
  //           setSettledValue({type: "resolved", value: result.default});
  //         }, (value) => {
  //           setSettledValue({type: "rejected", value});
  //         });
  //         setSettledValue({type: "pending", value: promise});
  //       }
  //     }, [settledValue]);
  //     switch (settledValue.type) {
  //       case "idle":
  //         return null;
  //       case "pending":
  //         throw settledValue.value;
  //       case "rejected":
  //         throw settledValue.value;
  //       case "resolved":
  //         return React.createElement(settledValue.value, props);
  //     }
  //   };
  // }

  // ${reExports}`,
  //           };
  //         }
  //       },
  //     },
}
