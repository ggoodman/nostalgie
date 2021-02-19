import * as Path from 'path';
import * as Shiki from 'shiki';
import { createRequire } from '../../../createRequire';

export interface CreateSnippetDataOptions {
  lang?: Shiki.Lang | (string & {});
  theme?: Shiki.Theme | (string & {});
  fromPath?: string;
}

export interface CreateSnippetDataResult {
  fgColor: string;
  bgColor: string;
  firstLineOffset: number;
  language?: string;
  tokensByLine: Token[][];
}

export type Token = string | [value: string, fgColor: string];

// Set up mdx using markdown
const mdLang = Shiki.BUNDLED_LANGUAGES.find((lang) => lang.id === 'markdown');
if (mdLang) {
  mdLang.aliases ??= [];
  mdLang.aliases.push('mdx');
}

export async function createSnippetData(
  code: string,
  options: CreateSnippetDataOptions
): Promise<CreateSnippetDataResult> {
  const theme = await loadTheme(options.theme || 'dark-plus', options.fromPath);

  if (!theme.name) {
    theme.name = options.theme;
  }

  const fgColor = theme.fg.toUpperCase();
  const bgColor = theme.bg.toUpperCase();

  let tokensByLine: Token[][] = [];

  if (
    options.lang &&
    Shiki.BUNDLED_LANGUAGES.some(
      (lang) =>
        lang.id === options.lang ||
        (Array.isArray(lang.aliases) && lang.aliases.includes(options.lang!))
    )
  ) {
    const highlighter = await loadHighlighterForTheme(theme);
    const themedTokens = highlighter.codeToThemedTokens(code.trim(), options.lang, theme.name!);

    tokensByLine = themedTokens.map((lineTokens) =>
      lineTokens.map((themedToken) => {
        return themedToken.color && themedToken.color !== fgColor
          ? [themedToken.content, themedToken.color]
          : themedToken.content;
      })
    );
  } else {
    tokensByLine = code.split(/\n|\r\n/).map((line) => {
      const token: Token = line;

      return [token];
    });
  }

  return {
    bgColor,
    fgColor,
    firstLineOffset: 0,
    language: options.lang,
    tokensByLine,
  };
}

export function fileNameToLanguage(filename: string): Shiki.Lang | undefined {
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
    case 'mdx':
      return 'markdown';
  }

  const shikiLang = Shiki.BUNDLED_LANGUAGES.find((lang) => lang.id === extName.slice(1));

  if (shikiLang) {
    console.log('found language', extName, shikiLang);
    return shikiLang.id as Shiki.Lang;
  }

  return undefined;
}

const highlighterCache = new Map<
  Shiki.IShikiTheme,
  Shiki.Highlighter | Promise<Shiki.Highlighter>
>();

function loadHighlighterForTheme(
  theme: Shiki.IShikiTheme
): Shiki.Highlighter | Promise<Shiki.Highlighter> {
  const cached = highlighterCache.get(theme);

  if (cached) {
    return cached;
  }

  const promise = Shiki.getHighlighter({
    langs: Shiki.BUNDLED_LANGUAGES,
    theme: theme,
  });

  highlighterCache.set(theme, promise);

  promise.then(
    (highlighter) => {
      highlighterCache.set(theme, highlighter);
    },
    () => {
      highlighterCache.delete(theme);
    }
  );

  return promise;
}

let nextCustomThemeSuffix = 0;

async function loadTheme(
  theme: Shiki.Theme | (string & {}),
  relPath?: string
): Promise<Shiki.IShikiTheme> {
  let loadedTheme: Shiki.IShikiTheme;

  if (Shiki.BUNDLED_THEMES.includes(theme)) {
    const require = createRequire(__filename);
    const themePath = require.resolve(`shiki/themes/${theme}.json`);

    loadedTheme = await Shiki.loadTheme(themePath);
  } else {
    loadedTheme = await Shiki.loadTheme(
      Path.resolve(process.cwd(), relPath ? Path.dirname(relPath) : '.', theme)
    );
  }

  if (!loadedTheme.name) {
    loadedTheme.name = `NostalgieCustomTheme${nextCustomThemeSuffix++}`;
  }

  return loadedTheme;
}
