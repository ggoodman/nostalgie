import type { MDXProviderComponents } from '@mdx-js/react';
import * as React from 'react';
import type { Context, CSSRules, Directive } from 'twind';
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

  // styled(Component)`...`
  <P extends {} = {}>(component: (props: P) => JSX.Element): StyledComponent<P>;
  // styled(Component, {...}) || styled(Component, '...')
  <P extends {} = {}>(
    component: (props: P) => JSX.Element,
    ...tokens: readonly MaybeThunk<React.CSSProperties | Falsy>[]
  ): (props: P) => JSX.Element;
}

type Falsy = '' | 0 | -0 | false | null | undefined | void;
type MaybeArray<T> = T | readonly T[];
type MaybeThunk<T> = T | ((context: Context) => T);

interface StyledComponent<P extends {} = {}> {
  (
    strings: TemplateStringsArray,
    ...interpolations: readonly MaybeThunk<
      MaybeArray<React.CSSProperties | string | number | Falsy>
    >[]
  ): (props: P) => JSX.Element;
  (tokens: MaybeThunk<MaybeArray<React.CSSProperties | Falsy>>): (props: P) => JSX.Element;
  (...tokens: readonly MaybeThunk<React.CSSProperties | Falsy>[]): (props: P) => JSX.Element;
}

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

function styledComponent<P extends {} = {}>(
  component: (props: P) => JSX.Element,
  parentDirective?: Directive<CSSRules>
): StyledComponent<P> {
  return function boundStyled(...args: any[]) {
    const directive = css(parentDirective, css(...args));

    // Can't figure out the 100% accurate typing here so we're going to bail out with some
    // anys.
    return function boundStyledElement(props?: any): any {
      return renderStyled(component, props, directive);
    };
  };
}

function styledHtml<T extends keyof React.ReactHTML>(
  elementType: T,
  parentDirective?: Directive<CSSRules>
): StyledHTML<T> {
  return function boundStyled(...args: any[]) {
    const directive = css(parentDirective, css(...args));

    // Can't figure out the 100% accurate typing here so we're going to bail out with some
    // anys.
    return function boundStyledElement(props?: any): any {
      return renderStyled(elementType, props, directive);
    };
  };
}

function renderStyled(
  elementType: keyof React.ReactHTML | ((props: any) => JSX.Element),
  { className, ...props }: any = {},
  directive: Directive<CSSRules>
) {
  const tw = React.useContext(TwindContext);
  const styledClassName = tw(directive);

  return React.createElement(elementType, {
    ...props,
    className: `${className ? `${className} ` : ''}${styledClassName}`,
  });
}

export const styled: StyledElements = new Proxy(renderStyled, {
  apply(
    _target: any,
    _this: any,
    [elementType, ...args]: [
      elementType: keyof React.ReactHTML | ((props: any) => JSX.Element),
      ...args: any[]
    ]
  ) {
    const directive = css(...args);

    return typeof elementType === 'string'
      ? styledHtml(elementType, directive)
      : styledComponent(elementType, directive);
  },
  get(_t, elementType: keyof React.ReactHTML) {
    return styledHtml(elementType);
  },
});

export type { MDXProviderComponents } from '@mdx-js/react';

export interface MDXProps extends React.PropsWithChildren<{ components: MDXProviderComponents }> {}
