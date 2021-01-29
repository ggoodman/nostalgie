import * as React from 'react';
import type { Context } from 'twind';
import { css } from 'twind/css';
import { TwindContext } from './internal';

export type StyledIntrinsicFactories = {
  [TIntrinsic in keyof React.ReactHTML]: StyledHTML<TIntrinsic>;
};

export interface StyledElements extends StyledIntrinsicFactories {
  // Bind an intrinsic HTML element
  <TIntrinsic extends keyof React.ReactHTML>(elementType: TIntrinsic): StyledHTML<TIntrinsic>;

  // Call with an intrinsic HTML element
  <T extends keyof React.ReactHTML>(
    elementType: T,
    strings: TemplateStringsArray,
    ...interpolations: readonly MaybeThunk<
      MaybeArray<React.CSSProperties | string | number | Falsy>
    >[]
  ): React.ReactHTML[T];
  <T extends keyof React.ReactHTML>(
    elementType: T,
    tokens: MaybeThunk<MaybeArray<React.CSSProperties | Falsy>>
  ): React.ReactHTML[T];
  <T extends keyof React.ReactHTML>(
    elementType: T,
    ...tokens: readonly MaybeThunk<React.CSSProperties | Falsy>[]
  ): React.ReactHTML[T];
}

type Falsy = '' | 0 | -0 | false | null | undefined | void;
type MaybeArray<T> = T | readonly T[];
type MaybeThunk<T> = T | ((context: Context) => T);

interface StyledHTML<T extends keyof React.ReactHTML> {
  (
    strings: TemplateStringsArray,
    ...interpolations: readonly MaybeThunk<
      MaybeArray<React.CSSProperties | string | number | Falsy>
    >[]
  ): React.ReactHTML[T];
  (tokens: MaybeThunk<MaybeArray<React.CSSProperties | Falsy>>): React.ReactHTML[T];
  (...tokens: readonly MaybeThunk<React.CSSProperties | Falsy>[]): React.ReactHTML[T];
}

function styledHtml<T extends keyof React.ReactHTML>(htmlElement: T): StyledHTML<T> {
  return function boundStyled(...args: any[]) {
    // Can't figure out the 100% accurate typing here so we're going to bail out with some
    // anys.
    return function boundStyledElement(props?: any): any {
      const tw = React.useContext(TwindContext);
      const className = tw(css(...args));

      return React.createElement(htmlElement, { ...props, className });
    };
  };
}

export const styled: StyledElements = new Proxy(Object.create(null), {
  apply(_target: any, _this: any, elementType: keyof React.ReactHTML, ...args: any) {
    // Can't figure out the 100% accurate typing here so we're going to bail out with some
    // anys.
    return function boundStyledElement(props?: any): any {
      const tw = React.useContext(TwindContext);
      const className = tw(css(...args));

      return React.createElement(elementType, { ...props, className });
    };
  },
  get(_t, elementType: keyof React.ReactHTML) {
    return styledHtml(elementType);
  },
});
