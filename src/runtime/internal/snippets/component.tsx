import * as React from 'react';
import type { CreateSnippetDataResult } from './parser';

export function createSnippetComponent(parseResult: CreateSnippetDataResult) {
  return function BoundCodeSnippet(props: Omit<CodeSnippetProps, 'parseResult'>) {
    return <CodeSnippet {...props} parseResult={parseResult} />;
  };
}

export interface CodeSnippetProps {
  parseResult: CreateSnippetDataResult;
  fromLine?: number;
  toLine?: number;
  emphasizeRanges?: Array<[fromLine: number, toLine: number]>;
}

export function CodeSnippet(props: CodeSnippetProps) {
  const { bgColor, fgColor, firstLineOffset, language, tokensByLine } = props.parseResult;
  const fromLine = Math.max(0, (props.fromLine || 1) - 1);
  const toLine = Math.max(fromLine + 1, props.toLine || tokensByLine.length);
  const lineSlice = tokensByLine.slice(fromLine, toLine);
  const firstLineNumber = firstLineOffset + fromLine + 1;
  const emphasizeLines = React.useMemo(
    () =>
      (props.emphasizeRanges || []).reduce((lines, [fromLine, toLine]) => {
        for (let i = fromLine; i <= toLine; i++) {
          lines.add(i);
        }

        return lines;
      }, new Set<number>()),
    [props.emphasizeRanges]
  );

  return (
    <pre
      data-lang={language}
      className={emphasizeLines.size ? 'has-emphasis' : undefined}
      style={{
        backgroundColor: bgColor,
        color: fgColor,
      }}
    >
      <code>
        {lineSlice.map((line, lineIdx) => {
          const lineNumber = firstLineNumber + lineIdx;

          return (
            <span
              className={emphasizeLines.has(lineNumber) ? 'has-emphasis' : undefined}
              data-lineno={lineNumber}
              key={lineNumber}
            >
              {line.map(([value, fgColor], tokenIdx) => {
                return (
                  <span key={tokenIdx} style={{ color: fgColor }}>
                    {value}
                  </span>
                );
              })}
              {lineIdx < lineSlice.length - 1 ? '\n' : null}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
