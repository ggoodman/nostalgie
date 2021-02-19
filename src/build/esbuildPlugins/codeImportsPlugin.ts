import type { Plugin } from 'esbuild';
import { promises as Fs } from 'fs';
import jsesc from 'jsesc';
import * as Path from 'path';
import * as Querystring from 'querystring';
import {
  createSnippetData,
  fileNameToLanguage,
} from '../../runtime/internal/components/snippetParser';
import type { NostalgieSettings } from '../../settings';
import { resolveAsync } from '../resolve';

interface CodeImportsPluginOptions {
  settings: NostalgieSettings;
}

export function codeImportsPlugin(options: CodeImportsPluginOptions): Plugin {
  const name = 'code-imports';

  return {
    name,
    setup(build) {
      build.onResolve(
        { filter: /^code:/, namespace: 'file' },
        async ({ path, importer, resolveDir }) => {
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
            pluginData: { importer, query: query ? Querystring.parse(query) : {}, resolveDir },
          };
        }
      );

      build.onLoad({ filter: /.*/, namespace: name }, async ({ path, pluginData }) => {
        const code = await Fs.readFile(path, 'utf8');
        const compiledCode = await createSnippetData(code, {
          fromPath: pluginData.importer as string,
          lang: fileNameToLanguage(path),
        });

        return {
          contents: `
            import { createSnippetComponent } from 'nostalgie/internal/components';

            export default createSnippetComponent(${jsesc(compiledCode, {
              es6: true,
              isScriptContext: true,
            })});
          `,
          resolveDir: pluginData?.resolveDir,
        };
      });
    },
  };
}
