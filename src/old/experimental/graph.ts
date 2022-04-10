import { build, ImportKind } from 'esbuild';
import * as Fs from 'fs';
import * as Path from 'path';
import resolve from 'resolve';

class Node {
  public edges: Edge[] = [];
  constructor(readonly id: string) {}

  ensureEdge(toSpec: string, toId: string, kind: ImportKind): boolean {
    if (
      !this.edges.some(
        (e) => e.kind === kind && e.toSpec === toSpec && e.toId === toId
      )
    ) {
      this.edges.push(new Edge(this.id, toSpec, toId, kind));
      return true;
    }

    return false;
  }
}

class Edge {
  constructor(
    readonly fromId: string,
    readonly toSpec: string,
    readonly toId: string,
    readonly kind: ImportKind
  ) {}
}

async function main() {
  console.time('main()');
  const root = new Node('<root>');
  const queue: Array<[Node, string]> = [[root, 'react']];
  const seen = new Set<string>();

  while (queue.length) {
    const [fromNode, next] = queue.shift()!;

    const resolvedAbs = await new Promise<string | undefined>(
      (promiseResolve, promiseReject) => {
        resolve(
          next,
          { basedir: Path.dirname(fromNode.id) },
          (err, resolved) => {
            if (err) {
              console.error(fromNode, next);
              return promiseReject(err);
            }

            return promiseResolve(resolved);
          }
        );
      }
    );

    // console.debug('%s ===> %s', fromNode, resolvedAbs);

    if (!resolvedAbs) {
      continue;
    }

    const node = new Node(resolvedAbs);

    if (seen.has(resolvedAbs)) {
      continue;
    }
    seen.add(resolvedAbs);

    await build({
      bundle: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
      stdin: {
        contents: await Fs.promises.readFile(resolvedAbs, 'utf-8'),
        resolveDir: Path.dirname(resolvedAbs),
        sourcefile: resolvedAbs,
      },
      write: false,
      plugins: [
        {
          name: 'externalize',
          setup(build) {
            build.onResolve(
              { filter: /.*/ },
              async ({ importer, path, kind }) => {
                if (importer === resolvedAbs) {
                  queue.push([node, path]);
                  return {
                    external: true,
                  };
                }
              }
            );
          },
        },
      ],
    });
  }
  console.timeEnd('main()');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

const SPEC_RX = /^((@[^/]+\/[^/@]+|[^./@][^/@]*)(?:@([^/]+))?)(.*)?$/;

type _BareModuleSpec<T = ReturnType<typeof parseBareModuleSpec>> = T extends
  | null
  | undefined
  ? never
  : T;
export type BareModuleSpec = _BareModuleSpec;

export function parseBareModuleSpec(bareModuleSpec: string) {
  const matches = bareModuleSpec.match(SPEC_RX);

  if (matches) {
    const [, nameSpec, name, spec, path = ''] = matches;

    return {
      nameSpec,
      name,
      spec,
      path,
    };
  }

  return null;
}
