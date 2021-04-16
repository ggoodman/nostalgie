export class ErrorWithCause extends Error {
  static getCause(err: unknown) {
    return err instanceof this ? err.cause : undefined;
  }

  readonly cause?: Error;
  readonly message: string;

  constructor(message: string, cause?: Error) {
    super(message);
    Object.setPrototypeOf(this, ErrorWithCause.prototype);
    this.message = message;
    this.cause = cause;
  }
}

export interface GetErrorLinesOptions {
  indent?: string;
  indentString?: string;
  indentDepth?: number;
}

export function getErrorLinesWithCause(
  err: unknown,
  { indent = '', indentString = '  ', indentDepth = 0 }: GetErrorLinesOptions = {}
): string[] {
  const errorText = String(err ? (err as any).message ?? err : 'Unknown error');
  const errorTextLines = errorText
    .split('\n')
    .map((line) => `${indent}${indentString.repeat(indentDepth)}${line}`);

  const cause = ErrorWithCause.getCause(err);

  return cause
    ? errorTextLines.concat(
        getErrorLinesWithCause(cause, { indent, indentString, indentDepth: indentDepth + 1 })
      )
    : errorTextLines;
}
