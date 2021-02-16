import { promises as Fs } from 'fs';
import jsesc from 'jsesc';
import * as Path from 'path';
import * as React from 'react';
import { BUNDLED_LANGUAGES, getHighlighter, IShikiTheme, Lang, loadTheme, Theme } from 'shiki';
import { createRequire } from '../../createRequire';
import { resolveAsync } from '../resolve';

export async function codeSnippetToComponent(
  code: string,
  options: {
    /**
     * Path relative to which themes will be loaded
     */
    basePath: string;
    /**
     * Name / and path of the file being converted
     */
    fileName: string;
    /**
     * @default `React.createElement`
     */
    jsxFactory?: string;

    lang?: Lang | (string & {});

    theme?: Theme | (string & {});
  }
): Promise<string> {
  const defaultTheme = 'github-dark';
  const themeRef = options.theme || defaultTheme;

  let theme: string | IShikiTheme = themeRef;
  let themeName = defaultTheme;
  let themePath: string;

  // A relative or absolute path means we need to load the theme
  if (themeRef.startsWith('./') || themeRef.startsWith('/')) {
    const resolvedThemeRef = await resolveAsync(themeRef, {
      basedir: Path.dirname(options.basePath),
      extensions: ['.json'],
    });

    if (!resolvedThemeRef.path) {
      throw new Error(
        `Unable to load the theme ${JSON.stringify(themeRef)} relative to ${JSON.stringify(
          options.basePath
        )}: Not found`
      );
    }

    themePath = resolvedThemeRef.path;
  } else {
    const require = createRequire(__filename);

    themePath = require.resolve(`shiki/themes/${themeName}.json`);
  }

  theme = await loadTheme(themePath);

  if (!theme.name) {
    themeName = themePath;
  }

  const highlighter = await getHighlighter({
    langs: BUNDLED_LANGUAGES,
    theme,
  });

  const lang = options.lang || fileNameToLanguage(options.fileName);
  const fgColor = highlighter.getForegroundColor().toUpperCase();
  const bgColor = highlighter
    .getBackgroundColor(typeof theme === 'string' ? theme : theme.name!)
    .toUpperCase();

  const tokens = highlighter.codeToThemedTokens(code, lang, themeName);

  const colorDataHistogram: { [color: string]: number } = Object.create(null);
  const tokenDataHistogram: { [token: string]: number } = Object.create(null);

  // Build up histograms of tokens and colors
  for (const line of tokens) {
    for (const token of line) {
      const color = token.color;

      tokenDataHistogram[token.content] = (tokenDataHistogram[token.content] || 0) + 1;

      if (color && color !== fgColor) {
        colorDataHistogram[color] = (colorDataHistogram[color] || 0) + 1;
      }
    }
  }
  // -----------------------
  // Create color dictionary
  // -----------------------
  const colorDictionaryKeys = dictionaryKeys();
  const colorToDictionaryKey = new Map<string, string>();
  const colorByDictionaryKey = new Map<string, string>();

  // We're unlikely to see enough colors to justify sorting and pruning
  for (const [color] of Object.entries(colorDataHistogram)) {
    const key = colorDictionaryKeys.take();
    colorByDictionaryKey.set(key, color);
    colorToDictionaryKey.set(color, key);
  }

  // -----------------------
  // Token dictionary
  // -----------------------
  const tokenDictionaryKeys = dictionaryKeys();
  const tokenByDictionaryKey = new Map<string, string>();
  const tokenToDictionaryKey = new Map<string, string>();

  // Array of interesting [token, frequency] pairs, sorted by compressability
  const interestingTokens = Object.entries(tokenDataHistogram)
    .filter((t) => t[0].length > 1 && t[1] > 1)
    .sort((a, b) => b[0].length * b[1] - a[0].length * a[1]);

  // Number of 'wrapper bytes' needed to encode a token in the dictionary
  // Equivalent to an opening and closing square brace, plus quotes.
  const jsEncodingOverhead = 4;

  for (const [token] of interestingTokens) {
    const nextKey = tokenDictionaryKeys.peek();

    if (nextKey.length + jsEncodingOverhead >= token.length) {
      // Not worth encoding
      continue;
    }

    const dictionaryKey = tokenDictionaryKeys.take();
    tokenByDictionaryKey.set(dictionaryKey, token);
    tokenToDictionaryKey.set(token, dictionaryKey);
  }

  type CompressedTokenValue =
    | string // Not in the dictionary
    | [tokenDictionaryKey: string]; // In the dictionary
  type CompressedToken = [token: CompressedTokenValue, colorDictionaryKey?: string]; // With color
  type CompressedLine = CompressedToken[];

  const compressed: CompressedLine[] = [];

  for (const line of tokens) {
    const compressedLine: CompressedLine = [];

    for (const token of line) {
      const color = token.color;
      const colorKey = color ? colorToDictionaryKey.get(color) : undefined;
      const tokenKey = tokenToDictionaryKey.get(token.content);
      const compressedTokenValue: CompressedTokenValue = tokenKey ? [tokenKey] : token.content;
      const compressedToken: CompressedToken = colorKey
        ? [compressedTokenValue, colorKey]
        : [compressedTokenValue];

      compressedLine.push(compressedToken);
    }

    compressed.push(compressedLine);
  }

  interface CodeSnippetProps {
    lineStart?: number;
    lineEnd?: number;
  }

  function createCodeSnippetComponent(
    h: typeof React.createElement,
    lines: CompressedLine[],
    colorDictionary: Record<string, string>,
    tokenDictionary: Record<string, string>,
    lang: string | undefined, // Encoded as a html-safe JSON string
    fgColor: string, // Encoded as a html-safe JSON string
    bgColor: string // Encoded as a html-safe JSON string
  ): React.FC<CodeSnippetProps> {
    const decodedLines = lines.map((tokens) =>
      tokens.map(([compressedTokenValue, colorKey]) => {
        const color = colorKey ? colorDictionary[colorKey] : undefined;
        const token = Array.isArray(compressedTokenValue)
          ? tokenDictionary[compressedTokenValue[0]]
          : compressedTokenValue;

        return { color, token };
      })
    );

    return function CodeSnippet(props: CodeSnippetProps): JSX.Element {
      const lineStart = Math.max(1, props.lineStart ?? 1);
      // Avoid throwing at runtime by clamping the end above the start
      const lineEnd = Math.max(lineStart, props.lineEnd ?? decodedLines.length);
      const lineSlice = decodedLines.slice(lineStart - 1, lineEnd - 1);

      return h(
        'pre',
        {
          className: 'snippet',
          'data-lang': lang,
          style: {
            backgroundColor: bgColor,
            color: fgColor,
          },
        },
        h(
          'code',
          null,
          lineSlice.map((line, idx) =>
            h(
              'span',
              {
                className: 'line',
                'data-line-number': lineStart + idx,
                key: idx,
                style: {
                  backgroundColor: bgColor,
                },
              },
              [
                ...line.map((token, idx) =>
                  h(
                    'span',
                    {
                      className: 'token',
                      key: idx,
                      style: {
                        color: token.color,
                      },
                    },
                    token.token
                  )
                ),
                '\n',
              ]
            )
          )
        )
      );
    };
  }

  const escapeAsJson = (value: unknown) =>
    jsesc(value, { es6: true, compact: true, isScriptContext: true });
  const args: Parameters<typeof createCodeSnippetComponent> = [
    React.createElement,
    compressed,
    Object.fromEntries(colorByDictionaryKey),
    Object.fromEntries(tokenByDictionaryKey),
    JSON.stringify(lang),
    JSON.stringify(fgColor),
    JSON.stringify(bgColor),
  ];

  return `function createSnippet(${createCodeSnippetComponent.toString()})(${
    options.jsxFactory || 'React.createElement'
  }, ${args.slice(1).map(escapeAsJson).join(', ')})`;
}

Fs.readFile(__filename, 'utf8').then((code) => {
  codeSnippetToComponent(code, { basePath: __filename, fileName: __filename }).then(
    console.log,
    console.error
  );
});

function fileNameToLanguage(filename: string): Lang | undefined {
  const extName = Path.extname(filename);

  switch (extName) {
    case '.js':
      return 'javascript';
    case '.jsx':
      return 'jsx';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.json':
      return 'json';
  }

  return;
}

function dictionaryKeys() {
  const charCodeUpperA = 'A'.charCodeAt(0);
  const charCodeUpperZ = 'Z'.charCodeAt(0);
  const charCodeLowerA = 'a'.charCodeAt(0);
  const charCodeLowerZ = 'z'.charCodeAt(0);

  let prefix = '';
  let nextPrefix = 'A';
  let suffix = 'A';

  const incrementPrefix = () => {
    prefix = nextPrefix;
    let charCode = nextPrefix.charCodeAt(0) + 1;

    if (charCode >= charCodeLowerA) {
      // In the 'a-z' range
      if (charCode > charCodeLowerZ) {
        // Wrap back to 'A'
        charCode = charCodeUpperA;
      }
    } else if (charCode > charCodeUpperZ) {
      // We're between 'Z' and 'a'
      charCode = charCodeLowerA;
    }

    nextPrefix = String.fromCharCode(charCode);
  };

  return {
    peek() {
      return `${prefix}${suffix}`;
    },
    take() {
      const result = `${prefix}${suffix}`;

      let nextSuffix = suffix.charCodeAt(0) + 1;

      if (nextSuffix >= charCodeLowerA) {
        // In the 'a-z' range
        if (nextSuffix > charCodeLowerZ) {
          // Wrap back to 'A'
          nextSuffix = charCodeUpperA;
          incrementPrefix();
        }
      } else if (nextSuffix > charCodeUpperZ) {
        // We're between 'Z' and 'a'
        nextSuffix = charCodeLowerA;
      }

      suffix = String.fromCharCode(nextSuffix);

      return result;
    },
  };
}
