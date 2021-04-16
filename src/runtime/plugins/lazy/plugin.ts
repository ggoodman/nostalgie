import Debug from 'debug';
import type { Plugin } from '../../../plugin';

const debug = Debug.debug('nostalgie:plugin:lazy');

export function lazyPlugin(): Plugin {
  const reactShimId = 'react-nostalgie-shim';

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
      debugger;
      console.dir(config);
    },

    // config(userConfig, env) {
    //   userConfig.resolve ??= {};
    //   userConfig.resolve.alias ??= [];
    //   (userConfig.resolve.alias as Alias[]).push({
    //     find: 'react',
    //     replacement: reactShimId,
    //     customResolver(source, importer, options) {
    //       if (source === 'react') {
    //         if (
    //           importer !== reactShimId &&
    //           !importer?.includes('/node_modules/')
    //         ) {
    //           debug('resolveId(%s, %s, %O)', source, importer, options);
    //           return reactShimId;
    //         }
    //       }
    //     },
    //   });
    // },

    // resolveId(source, importer, options, ssr) {
    //   if (source === 'react') {
    //     if (importer !== reactShimId && !importer?.includes('/node_modules/')) {
    //       debug('resolveId(%s, %s, %O, %j)', source, importer, options, ssr);
    //       return reactShimId;
    //     }
    //   }

    //   if (source === reactShimId) {
    //     debugger;
    //     return reactShimId;
    //   }

    //   return null;
    // },

    //     load(id, ssr) {
    //       debug('load(%s, %j)', id, ssr);
    //       if (id === reactShimId) {
    //         return {
    //           code: `
    // import * as React from 'react';

    // export * from 'react';

    // // const React = require('react');
    // // // const { lazy } = require(${JSON.stringify('TBD')});

    // // const Suspense = ${JSON.stringify(ssr)} ? React.Suspense : React.Fragment;

    // // module.exports = {
    // //   ...React,
    // //   lazy,
    // //   Suspense,
    // // };
    //           `,
    //         };
    //       }
    //     },

    // renderDynamicImport(options) {
    //   const targetModuleId = options.targetModuleId;

    //   if (!targetModuleId) {
    //     return null;
    //   }

    //   return {
    //     left: `Object.defineProperty(`,
    //     right: `,Symbol.for('nostalgie.lazy'),{value: ${JSON.stringify(
    //       targetModuleId
    //     )}})`,
    //   };
    // },
  };
}
