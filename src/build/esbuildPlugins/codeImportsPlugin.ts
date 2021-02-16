import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import * as Path from 'path';
import * as Querystring from 'querystring';
import type { NostalgieSettings } from '../../settings';
import { resolveAsync } from '../resolve';
import { codeSnippetToComponent } from './snippetizer';

interface CodeImportsPluginOptions {
  settings: NostalgieSettings;
}

export function codeImportsPlugin(options: CodeImportsPluginOptions): Plugin {
  const name = 'code-imports';

  return {
    name,
    setup(build) {
      build.onResolve({ filter: /^code:/, namespace: 'file' }, async ({ path, importer }) => {
        const [spec, query] = path.slice(5).split('?', 2);
        const resolved = await resolveAsync(spec, {
          basedir: importer ? Path.dirname(importer) : undefined,
          extensions: options.settings.resolveExtensions,
        });

        if (!resolved.path) {
          throw new Error(
            `Unable to resolve the code import ${JSON.stringify(spec)} from ${JSON.stringify(
              importer
            )}`
          );
        }

        return {
          path: resolved.path,
          namespace: name,
          pluginData: { importer, query: query ? Querystring.parse(query) : {} },
        };
      });

      build.onLoad({ filter: /.*/, namespace: name }, async ({ path, pluginData }) => {
        const defaultTheme = 'github-dark';

        const code = await Fs.readFile(path, 'utf8');
        const compiledCode = await codeSnippetToComponent(code, {
          basePath: pluginData.importer as string,
          fileName: path,
          jsxFactory: 'React.createElement',
          theme: pluginData?.theme || defaultTheme,
        });

        return {
          contents: `
            export default ${compiledCode};
          `,
        };
      });
    },
  };
}
