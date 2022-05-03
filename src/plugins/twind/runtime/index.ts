import isPropValid from '@emotion/is-prop-valid';
import {
  createElement,
  forwardRef,
  useContext,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
} from 'react';
import {
  style,
  TW,
  type CSSRules,
  type Directive,
  type Style,
  type StyleConfig,
  type StyleProps,
} from 'twind/style';
import { invariant } from '../../../invariant';
import { TwindContext } from './context';
import type { PolymorphicPropsWithRef } from './types';

export { apply, css, style, type Style } from 'twind/style';

export interface StyledComponent<Variants, Tag extends ElementType> {
  <T extends ElementType = Tag>(
    props: PolymorphicPropsWithRef<StyleProps<Variants>, T>
  ): ReactElement<any, any> | null;

  toString(): string;

  readonly className: string;

  readonly selector: string;

  readonly style: Style<Variants>;
}

export type StyledComponentProps<
  Variants,
  Tag extends ElementType
> = PolymorphicPropsWithRef<StyleProps<Variants>, Tag>;

export function styled<Variants, Tag extends ElementType>(
  tag: Tag,
  config?: StyleConfig<Variants>
): StyledComponent<Variants, Tag> & string;
export function styled<Variants, Tag extends ElementType, BaseVariants>(
  tag: StyledComponent<BaseVariants, Tag>,
  config?: StyleConfig<Variants, BaseVariants>
): StyledComponent<Variants & BaseVariants, Tag> & string;
export function styled<Variants, Tag extends ElementType>(
  tag: Tag,
  config?: Style<Variants>
): StyledComponent<Variants, Tag> & string;

export function styled<Variants, Tag extends ElementType, BaseVariants = {}>(
  tag: Tag | StyledComponent<BaseVariants, Tag>,
  config?: StyleConfig<Variants> | Style<Variants>
): StyledComponent<Variants, Tag> & string {
  const base =
    typeof config === 'function'
      ? config
      : isStyled(tag)
      ? style(tag.style, config)
      : style(config);

  const sc = forwardRef(
    <T extends ElementType = Tag>(
      {
        as: asType,
        children,
        className,
        css,
        tw: twProp,
        ...props
      }: PolymorphicPropsWithRef<StyleProps<Variants>, T>,
      ref: ForwardedRef<any>
    ) => {
      const tw = useContext(TwindContext);

      invariant(tw, 'Missing Twind context');

      const forwardedProps: any = {
        ref,
      };

      for (const prop in props) {
        if (isPropValid(prop)) {
          forwardedProps[prop] = props[prop as keyof typeof props];
        }
      }

      forwardedProps.className = dedupeClassNames(
        tw(
          base({
            ...props,
            className,
            css,
            tw: twProp,
          } as StyleProps<Variants>)
        )
      );

      return createElement(
        typeof asType === 'string' ? asType : tag,
        forwardedProps,
        children
      );
    }
  );

  return Object.defineProperties(sc, {
    className: {
      get: () => base.className,
    },
    selector: {
      get: () => base.selector,
    },
    style: {
      value: base,
    },
    toString: {
      value: base.toString,
    },
  }) as unknown as StyledComponent<Variants, Tag> & string;
}

export function useTwind(): TW {
  const tw = useContext(TwindContext);

  invariant(tw, 'Missing Twind context');

  return tw;
}

function isStyled(cmp: ElementType): cmp is StyledComponent<any, any> {
  return (
    cmp != null && (cmp as StyledComponent<any, ElementType>).style != null
  );
}

function dedupeClassNames(className: string) {
  // Necessary to avoid warnings about SSR / CSR mismatch
  return [...new Set(className.split(' '))].join(' ');
}

export function variant<Options extends string>(
  options: Record<Options, unknown>,
  fn: (option: Options) => string | CSSRules | Directive<CSSRules>
): Record<Options, string | CSSRules | Directive<CSSRules>> {
  const variant = {} as Record<
    Options,
    string | CSSRules | Directive<CSSRules>
  >;

  for (const option in options) {
    variant[option] = fn(option);
  }

  return variant;
}
