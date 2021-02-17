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

export type Token = [value: string, fgColor?: string];

export async function createSnippetData(
  code: string,
  options: CreateSnippetDataOptions
): Promise<CreateSnippetDataResult> {
  const theme = await loadTheme(options.theme || 'dark-plus', options.fromPath);

  if (!theme.name) {
    theme.name = options.theme;
  }

  const highlighter = await loadHighlighterForTheme(theme);
  const fgColor = highlighter.getForegroundColor().toUpperCase();
  const bgColor = highlighter.getBackgroundColor(theme.name!).toUpperCase();
  const themedTokens = highlighter.codeToThemedTokens(code.trim(), options.lang, theme.name!);
  const tokensByLine: Token[][] = themedTokens.map((lineTokens) =>
    lineTokens.map((themedToken) => {
      return themedToken.color && themedToken.color !== fgColor
        ? [themedToken.content, themedToken.color]
        : [themedToken.content];
    })
  );

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
  }

  // Fall back to 'best effort' of extension.
  return extName.slice(1) as any;
}

const highlighterCache = new Map<string, Shiki.Highlighter | Promise<Shiki.Highlighter>>();

function loadHighlighterForTheme(
  theme: Shiki.IShikiTheme
): Shiki.Highlighter | Promise<Shiki.Highlighter> {
  const cached = highlighterCache.get(theme.name!);

  if (cached) {
    return cached;
  }

  const promise = Shiki.getHighlighter({
    langs: Shiki.BUNDLED_LANGUAGES,
    theme: theme.name,
  });

  highlighterCache.set(theme.name!, promise);

  promise.then(
    (highlighter) => {
      highlighterCache.set(theme.name!, highlighter);
    },
    () => {
      highlighterCache.delete(theme.name!);
    }
  );

  return promise;
}

function loadTheme(
  theme: Shiki.Theme | (string & {}),
  relPath?: string
): Promise<Shiki.IShikiTheme> {
  if (Shiki.BUNDLED_THEMES.includes(theme)) {
    const require = createRequire(__filename);
    const themePath = require.resolve(`shiki/themes/${theme}.json`);

    return Shiki.loadTheme(themePath);
  }

  if (Path.isAbsolute(theme)) {
    return Shiki.loadTheme(theme);
  }

  return Shiki.loadTheme(Path.resolve(relPath || '.', theme));
}
