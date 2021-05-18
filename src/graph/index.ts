import { BabelFileResult, ParserOptions, transformSync } from '@babel/core';
// @ts-ignore
import babelPluginTransfirnReactJsxSelf from '@babel/plugin-transform-react-jsx-self';
// @ts-ignore
import babelPluginTransformReactJsxSource from '@babel/plugin-transform-react-jsx-source';
import type { Node } from '@babel/types';
import {
  CachedInputFileSystem,
  FileSystem,
  ResolverFactory,
} from 'enhanced-resolve';
import { build, ImportKind, Loader } from 'esbuild';
import * as Fs from 'fs';
import Module from 'module';
import * as Path from 'path';
// @ts-ignore
import reactRefreshBabel from 'react-refresh/babel';
import { invariant } from '../invariant';

class Barrier {
  private promise?: Promise<void>;
  private resolve?: () => void;

  open() {
    if (this.resolve) {
      this.resolve();
      this.promise = undefined;
      this.resolve = undefined;
    }
  }

  wait(): Promise<void> {
    if (!this.promise) {
      this.promise = new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }

    return this.promise;
  }
}

interface UnresolvedEdge {
  kind: ImportKind;
  fromId: string;
  fromContext: string;
  toSpec: string;
}

interface ResolvedEdge {
  kind: ImportKind;
  fromId: string;
  toId: string;
  toSpec: string;
  dirContentsDependencies: Set<string>;
  fileDependencies: Set<string>;
  fileExistenceDependencies: Set<string>;
}

interface ResolveContext {
  contextDependencies: Set<string>;

  /**
   * files that was found on file system
   */
  fileDependencies: Set<string>;

  /**
   * dependencies that was not found on file system
   */
  missingDependencies: Set<string>;
}

interface File {
  id: string;
  content: string;
}

export const rootId = '<root>';

export interface BuildGraphOptions {
  conditionNames?: string[];
  define?: Record<string, string>;
  fs?: FileSystem;
  ignoreModules?: string[];
  resolveExtensions?: string[];
  rootDir?: string;
}

async function buildGraph(
  entrypoint: string[],
  options: BuildGraphOptions = {}
) {
  if (!Array.isArray(entrypoint) || !entrypoint.length) {
    throw new TypeError(
      'An array containing at least one entrypoint is required'
    );
  }

  const fileSystem = new CachedInputFileSystem(options.fs ?? Fs, 4000);
  const resolver = ResolverFactory.createResolver({
    pnpApi: null,
    // TODO: Configurable condition names
    conditionNames: options.conditionNames ?? ['import', 'require', 'default'],
    useSyncFileSystemCalls: false,
    fileSystem,
    // TODO: Configurable file extensions
    extensions: options.resolveExtensions ?? [
      '.js',
      '.jsx',
      '.json',
      '.ts',
      '.tsx',
    ],
  });
  const rootDir = options.rootDir ?? process.cwd();
  /** Dependencies that we will ignore */
  const ignoreEdge = new Set(Module.builtinModules);

  /** Queue of unresolved edges needing to be resolved */
  const unresolvedEdgeQueue: UnresolvedEdge[] = [];
  /** Edges that have already been recognized */
  // TODO: Is it worth trying to dedupe edges?
  // const seenEdge = new MapMapSet<string, ImportKind, string>();

  /** Queue of files needing to be parsed */
  const unparsedFileQueue: string[] = [];
  /** Files that have been seen */
  const seenFiles = new Set<string>();

  const edges = new Set<ResolvedEdge>();
  const files = new Map<string, File>();

  const readFile = (fileName: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      return fileSystem.readFile(
        fileName,
        { encoding: 'utf8' },
        (err, result) => {
          if (err) {
            return reject(err);
          }

          return resolve(result as string);
        }
      );
    });
  };

  const resolve = (
    spec: string,
    fromId: string
  ): Promise<{ resolved: string | false | undefined; ctx: ResolveContext }> => {
    const ctx = {
      fileDependencies: new Set<string>(),
      missingDependencies: new Set<string>(),
      contextDependencies: new Set<string>(),
    };

    return new Promise((resolve, reject) =>
      resolver.resolve({}, fromId, spec, ctx, (err, resolved) => {
        if (err) {
          return reject(err);
        }

        return resolve({ ctx, resolved });
      })
    );
  };

  // We can't let this throw because nothing will register a catch handler.
  const parseFile = async (fileName: string): Promise<void> => {
    try {
      const sourceContent = await readFile(fileName);
      const loader = loaderForPath(fileName);

      if (!loader) {
        // We can't figure out a loader so let's just treat it as a leaf node
        files.set(fileName, { content: sourceContent, id: fileName });
        return;
      }

      const file = maybeTransformReactRefresh({
        id: fileName,
        content: sourceContent,
      });

      const buildResult = await build({
        bundle: true,
        define: {
          // TODO: Dynamic env vars
          'process.env.NODE_ENV': JSON.stringify('development'),
        },
        // entryPoints: [fileName],
        format: 'esm',
        logLevel: 'error',
        metafile: true,
        platform: 'neutral',
        plugins: [
          {
            name: 'capture-edges',
            setup: (build) => {
              build.onResolve({ filter: /.*/ }, (args) => {
                // if (args.kind === 'entry-point') {
                //   return;
                // }

                if (!ignoreEdge.has(args.path)) {
                  unresolvedEdgeQueue.push({
                    fromId: fileName,
                    fromContext: args.resolveDir,
                    kind: args.kind,
                    toSpec: args.path,
                  });
                }

                // Mark everythign as external. We're only using esbuild to transform
                // on a file-by-file basis and capture dependencies.
                return { external: true };
              });
            },
          },
          {
            name: 'react-refresh',

            setup: (build) => {
              const reactRefreshInjection = 'inject-react-refresh.js';
              const options = build.initialOptions;

              options.inject ??= [];
              options.inject.push(reactRefreshInjection);

              build.onLoad({ filter: /.*/, namespace: 'file' }, (args) => {
                if (args.path.endsWith(reactRefreshInjection)) {
                  return {
                    contents: `
  import RefreshRuntime from 'react-refresh/runtime';
  
  RefreshRuntime.injectIntoGlobalHook(window) 
  
  export const $RefreshReg$ = () => {};
  export const $RefreshSig$ = () => (type) => type;
                    `.trim(),
                  };
                }
              });
            },
          },
        ],
        // sourcemap: true,
        // sourcesContent: true,
        stdin: {
          contents: file.content,
          resolveDir: Path.dirname(fileName),
          loader: loaderForPath(fileName),
          sourcefile: fileName,
        },
        // TODO: Dynamic target
        target: 'node14',
        treeShaking: true,
        write: false,
      });

      files.set(fileName, {
        id: fileName,
        content: buildResult.outputFiles[0].text,
      });
    } catch (err) {
      console.error('parseFile error', err);
    }
  };

  // We can't let this throw because nothing will register a catch handler.
  const resolveEdge = async (edge: UnresolvedEdge): Promise<void> => {
    try {
      const {
        ctx: { contextDependencies, fileDependencies, missingDependencies },
        resolved,
      } = await resolve(edge.toSpec, edge.fromContext);

      // TODO: We need special handling for `false` files and proper error handling
      // for files that failed to resolve.
      invariant(resolved, 'All files must successfully resolve (for now)');

      // Record the resolved edge.
      // TODO: Make sure we don't record the same logical edge twice.
      edges.add({
        fromId: edge.fromId,
        toId: resolved,
        toSpec: edge.toSpec,
        kind: edge.kind,
        fileDependencies: fileDependencies,
        dirContentsDependencies: contextDependencies,
        fileExistenceDependencies: missingDependencies,
      });
      unparsedFileQueue.push(resolved);
      barrier.open();
    } catch (err) {
      console.error('resolveEdge error', err);
    }
  };

  const promises = new Set<Promise<unknown>>();
  const track = (op: Promise<unknown>) => {
    promises.add(op);
    op.finally(() => promises.delete(op));
  };

  for (const entrypointSpec of entrypoint) {
    unresolvedEdgeQueue.push({
      fromId: rootId,
      fromContext: rootDir,
      toSpec: entrypointSpec,
      kind: 'entry-point',
    });
  }

  const barrier = new Barrier();

  while (unparsedFileQueue.length || unresolvedEdgeQueue.length) {
    while (unparsedFileQueue.length) {
      const unparsedFile = unparsedFileQueue.shift()!;

      if (!seenFiles.has(unparsedFile)) {
        seenFiles.add(unparsedFile);

        track(parseFile(unparsedFile));
      }
    }

    while (unresolvedEdgeQueue.length) {
      const unresolvedEdge = unresolvedEdgeQueue.shift()!;

      track(resolveEdge(unresolvedEdge));
    }

    while (promises.size) {
      await Promise.race([barrier.wait(), ...promises]);
    }
  }

  return { edges, files };
}

function loaderForPath(fileName: string): Loader | undefined {
  const ext = Path.extname(fileName).slice(1);
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'js';
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'json':
    case 'css':
      return ext;
  }
}

// class MapMapSet<K, K2, V> {
//   private items = new Map<K, Map<K2, Set<V>>>();

//   add(key: K, subkey: K2, value: V) {
//     let itemValues = this.items.get(key);

//     if (!itemValues) {
//       itemValues = new Map();
//       this.items.set(key, itemValues);
//     }

//     let subkeyValues = itemValues.get(subkey);

//     if (!subkeyValues) {
//       subkeyValues = new Set();
//       itemValues.set(subkey, subkeyValues);
//     }

//     subkeyValues.add(value);

//     return this;
//   }

//   has(key: K, subkey: K2, value: V): boolean {
//     return this.items.get(key)?.get(subkey)?.has(value) === true;
//   }
// }

if (require.main === module)
  (async () => {
    console.time('buildGraph');
    const graph = await buildGraph(['./app/src/App'], {});
    console.timeEnd('buildGraph');

    console.log(
      'Found %d modules with %d edges',
      graph.files.size,
      graph.edges.size
    );

    console.time('partitionGraph');
    const partitioned = partitionGraph(graph);
    console.timeEnd('partitionGraph');

    console.log('Partitioned graph into %d chunks', partitioned.size);

    // console.dir(partitioned, { depth: 2 });

    console.log(await partitioned.values().next().value?.build());
  })();

class Chunk {
  private readonly entrypointsBySpec = new Map<string, string>();
  private readonly outgoingEdges = new Map<string, Map<string, string>>();
  private readonly filesById = new Map<string, File>();

  constructor(public readonly id: string) {}

  add(
    incomingEdge: ResolvedEdge,
    file: File,
    outgoingEdges?: Set<ResolvedEdge>
  ) {
    const fromChunkId = getChunkId(incomingEdge.fromId);

    if (fromChunkId !== this.id) {
      this.entrypointsBySpec.set(incomingEdge.toSpec, incomingEdge.toId);
    }

    this.filesById.set(file.id, file);

    if (outgoingEdges) {
      for (const outgoingEdge of outgoingEdges) {
        let outgoingEdgesForFile = this.outgoingEdges.get(file.id);
        if (!outgoingEdgesForFile) {
          outgoingEdgesForFile = new Map();
          this.outgoingEdges.set(file.id, outgoingEdgesForFile);
        }

        outgoingEdgesForFile.set(outgoingEdge.toSpec, outgoingEdge.toId);
      }
    }
  }

  async build() {
    const entryPoints = Object.fromEntries(this.entrypointsBySpec);

    const result = await build({
      bundle: true,
      chunkNames: `${this.id}-[hash]`,
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
      entryNames: `[name]-[hash]`,
      entryPoints,
      format: 'esm',
      outdir: '/',
      platform: 'neutral',
      plugins: [
        {
          name: 'chunk-builder',
          setup: (build) => {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === 'entry-point') {
                return {
                  path: args.path,
                };
              }

              const outgoingEdgesForFile = this.outgoingEdges.get(
                args.importer
              );

              invariant(
                outgoingEdgesForFile,
                `Chunk inconsistency: the chunk ${this.id} is outgoing edges for ${args.importer}.`
              );

              const toId = outgoingEdgesForFile.get(args.path);

              invariant(
                toId,
                `Chunk inconsistency: the chunk ${this.id} is missing the edge from ${args.importer} to ${args.path}.`
              );

              const toChunkId = getChunkId(toId);
              const isExternal = toChunkId !== this.id;

              return {
                external: isExternal,
                path: isExternal ? toId : toId,
              };
            });

            build.onLoad({ filter: /.*/ }, (args) => {
              const file = this.filesById.get(args.path);

              invariant(
                file,
                `Chunk inconsistency: the chunk ${this.id} is missing the file ${args.path}, deemed as internal.`
              );

              return {
                contents: file.content,
              };
            });
          },
        },
      ],
      splitting: true,
      treeShaking: true,
      write: false,
    });

    return result.outputFiles.map((file) => ({
      path: file.path,
      contents: file.text,
    }));
  }
}

function maybeTransformReactRefresh(file: File): File {
  if (!/\.[jt]sx$/.test(file.id) || file.id.includes('node_modules')) {
    return file;
  }

  // plain js/ts files can't use React without importing it, so skip
  // them whenever possible
  if (!file.id.endsWith('x') && !file.content.includes('react')) {
    return file;
  }

  const parserPlugins: ParserOptions['plugins'] = [
    'jsx',
    'importMeta',
    // since the plugin now applies before esbuild transforms the code,
    // we need to enable some stage 3 syntax since they are supported in
    // TS and some environments already.
    'topLevelAwait',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
  ];
  if (/\.tsx?$/.test(file.id)) {
    // it's a typescript file
    // TODO: maybe we need to read tsconfig to determine parser plugins to
    // enable here, but allowing decorators by default since it's very
    // commonly used with TS.
    parserPlugins.push('typescript', 'decorators-legacy');
  }

  const result = transformSync(file.content, {
    babelrc: false,
    configFile: false,
    filename: file.id,
    parserOpts: {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
      plugins: parserPlugins,
    },
    generatorOpts: {
      decoratorsBeforeExport: true,
    },
    plugins: [
      babelPluginTransfirnReactJsxSelf,
      babelPluginTransformReactJsxSource,
      [reactRefreshBabel, {}],
    ],
    // ast: !isReasonReact,
    sourceMaps: true,
    sourceFileName: file.id,
  });

  if (!/\$RefreshReg\$\(/.test(result?.code ?? '')) {
    // no component detected in the file
    return file;
  }

  const header = `
  import RefreshRuntime from "react-refresh/runtime";
  let prevRefreshReg;
  let prevRefreshSig;

  if (import.meta.hot) {
    prevRefreshReg = $RefreshReg$;
    prevRefreshSig = $RefreshSig$;
    $RefreshReg$ = (type, id) => {
      RefreshRuntime.register(type, ${JSON.stringify(file.id)} + " " + id)
    };
    $RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
  }`.replace(/[\n]+/gm, '');

  const footer = `
  if (import.meta.hot) {
    $RefreshReg$ = prevRefreshReg;
    $RefreshSig$ = prevRefreshSig;
    ${isRefreshBoundary(result?.ast) ? `import.meta.hot.accept();` : ``}
    if (!window.__vite_plugin_react_timeout) {
      window.__vite_plugin_react_timeout = setTimeout(() => {
        window.__vite_plugin_react_timeout = 0;
        RefreshRuntime.performReactRefresh();
      }, 30);
    }
  }`;

  return {
    id: file.id,
    content: `${header}${result?.code ?? ''}${footer}`,
  };
}

function getChunkId(uri: string): string {
  const matches = uri.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);

  return matches ? matches[1] : uri;
}

function partitionGraph(graph: {
  edges: Set<ResolvedEdge>;
  files: Map<string, File>;
}) {
  const edgesBySourceId = new Map<string, Set<ResolvedEdge>>();

  for (const edge of graph.edges) {
    let sourceEdges = edgesBySourceId.get(edge.fromId);

    if (!sourceEdges) {
      sourceEdges = new Set();
      edgesBySourceId.set(edge.fromId, sourceEdges);
    }

    sourceEdges.add(edge);
  }

  const rootEdges = edgesBySourceId.get(rootId);

  invariant(rootEdges?.size, 'Missing edges from the root to the entrypoints');

  const chunks = new Map<string, Chunk>();
  const queue = [...rootEdges];
  const seenEdges = new Set<ResolvedEdge>();

  while (queue.length) {
    const edge = queue.shift()!;

    if (seenEdges.has(edge)) {
      continue;
    }
    seenEdges.add(edge);

    const nextEdges = edgesBySourceId.get(edge.toId);

    const fromChunkId = getChunkId(edge.fromId);
    const toChunkId = getChunkId(edge.toId);
    const toFile = graph.files.get(edge.toId);

    invariant(toFile, `Graph inconsistency, missing file ${toChunkId}`);

    let fileChunk: Chunk | undefined;

    if (edge.fromId !== rootId) {
      // By default we'll add the file to the source chunk.
      let fromChunk = chunks.get(fromChunkId);

      if (!fromChunk) {
        fromChunk = new Chunk(fromChunkId);
        chunks.set(fromChunkId, fromChunk);
      }
    }

    if (fromChunkId !== toChunkId) {
      let toChunk = chunks.get(toChunkId);
      if (!toChunk) {
        toChunk = new Chunk(toChunkId);
        chunks.set(toChunkId, toChunk);
      }
      // If the edge crosses chunks, we'll add the file to the target chunk.
      fileChunk = toChunk;
    }

    if (fileChunk) {
      fileChunk.add(edge, toFile, nextEdges);
    }

    if (nextEdges) {
      queue.push(...nextEdges);
    }
  }

  return chunks;
}

function isRefreshBoundary(ast: BabelFileResult['ast']) {
  if (!ast) {
    return false;
  }

  // Every export must be a React component.
  return ast.program.body.every((node) => {
    if (node.type !== 'ExportNamedDeclaration') {
      return true;
    }
    const { declaration, specifiers } = node;
    if (declaration) {
      if (declaration.type === 'VariableDeclaration') {
        return declaration.declarations.every((variable) =>
          isComponentLikeIdentifier(variable.id)
        );
      }
      if (declaration.type === 'FunctionDeclaration') {
        return isComponentLikeIdentifier(declaration.id);
      }
    }
    return specifiers.every((spec) => {
      return isComponentLikeIdentifier(spec.exported);
    });
  });
}

function isComponentLikeIdentifier(node?: Node | null) {
  return node && node.type === 'Identifier' && isComponentLikeName(node.name);
}

function isComponentLikeName(name?: string | null) {
  return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z';
}
