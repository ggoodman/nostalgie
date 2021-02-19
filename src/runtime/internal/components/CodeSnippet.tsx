import * as React from 'react';
import { styled } from '../../styling';
import type { CreateSnippetDataResult } from './snippetParser';

export function createSnippetComponent(parseResult: CreateSnippetDataResult) {
  return function BoundCodeSnippet(props: Omit<CodeSnippetProps, 'parseResult'>) {
    return <CodeSnippet {...props} parseResult={parseResult} />;
  };
}

export interface BoundCodeSnippet {
  (props: Omit<CodeSnippetProps, 'parseResult'>): JSX.Element;
}

export interface CodeSnippetProps {
  className?: string;
  parseResult: CreateSnippetDataResult;
  fromLine?: number;
  toLine?: number;
  emphasizeRanges?: Array<[fromLine: number, toLine: number]>;
}

function CodeSnippetComponent(props: CodeSnippetProps) {
  const { bgColor, fgColor, firstLineOffset, language, tokensByLine } = props.parseResult;
  const fromLine = Math.max(0, (props.fromLine || 1) - 1);
  const toLine = Math.max(fromLine + 1, props.toLine || tokensByLine.length);
  const lineSlice = tokensByLine.slice(fromLine, toLine);
  const firstLineNumber = firstLineOffset + fromLine + 1;
  const emphasizeLines = React.useMemo(
    () =>
      (props.emphasizeRanges || []).reduce((lines, [fromLine, toLine]) => {
        for (let i = fromLine; i <= toLine; i++) {
          // The ranges passed in will be 1-indexed and compared to the 1-based lineNumber
          // so no modification is needed.
          lines.add(i);
        }

        return lines;
      }, new Set<number>()),
    [props.emphasizeRanges]
  );
  const bgHex = hexToRgb(bgColor);
  const fgHex = hexToRgb(fgColor);
  const classNames = [props.className, emphasizeLines.size ? 'has-emphasis' : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <pre
      data-lang={language || 'unknown'}
      className={classNames}
      style={{
        backgroundColor: bgColor,
        color: fgColor,
        //@ts-ignore
        '--bgColor': bgHex ? `${bgHex.r}, ${bgHex.g}, ${bgHex.b}` : bgColor,
        //@ts-ignore
        '--fgColor': fgHex ? `${fgHex.r}, ${fgHex.g}, ${fgHex.b}` : fgColor,
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
              {line.map((token, tokenIdx) => {
                const [value, fgColor] = Array.isArray(token) ? token : [token];

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

export const CodeSnippet = styled(CodeSnippetComponent)`
  pre&[data-lang] {
    position: relative;
    overflow: auto;
    padding-left: 0;
    padding-right: 0;
  }

  & > code {
    padding: 0.857143em 0;
    display: block;
    min-width: 100%;
  }

  &::before {
    content: attr(data-lang);
    margin-right: 0;
    text-align: right;
    position: sticky;
    right: 1.14286rem;
    top: 0.857143rem;
    opacity: 80%;
    text-shadow: black 0 0 4px;
    display: block;
    float: right;
    background-color: var(--bgColor, transparent);
    z-index: 1;
  }

  & span[data-lineno] {
    display: block;
    transition: filter 0.2s ease-in-out;
  }

  & span[data-lineno]::before {
    display: inline-block;
    position: sticky;
    left: 0;
    content: attr(data-lineno);
    background-color: rgb(var(--bgColor, transparent));
    color: rgba(var(--fgColor), 0.8);
    text-align: right;
    padding-right: 0.4rem;
    margin-right: 0.4em;
    transition: filter, border-color 0.2s ease-in-out;
    width: 4rem;
  }

  span[data-lineno].has-emphasis::before {
    border-left: 0.3rem solid rgba(var(--fgColor), 0.8);
  }

  &.has-emphasis {
    span[data-lineno]:not(.has-emphasis) {
      filter: saturate(0.75) brightness(0.8);
    }

    &:hover {
      span[data-lineno] {
        filter: saturate(1) brightness(1);

        &.has-emphasis::before {
          border-left: 0.3rem solid rgba(var(--fgColor), 0.9);
        }
      }
    }
  }

  &.has-emphasis span[data-lineno].has-emphasis {
    opacity: 1;
    background-color: rgb(var(--bgColor, transparent));
    filter: contrast(1.2);
  }
`;

// export const CodeSnippet = CodeSnippetComponent;

function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (_, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
