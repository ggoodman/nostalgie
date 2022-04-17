import React, {
  createElement,
  ElementType,
  ForwardedRef,
  forwardRef,
  ReactElement,
  useContext,
} from 'react';
import { Style, style, StyleConfig, StyleProps, TW } from 'twind/style';
import { invariant } from '../../../../invariant';
import { TwindContext } from './context';
import type { PolymorphicPropsWithRef } from './types';

export interface StyledComponent<Variants, Tag extends ElementType> {
  <T extends React.ElementType = Tag>(
    props: PolymorphicPropsWithRef<Omit<StyleProps<Variants>, 'class'>, T>
  ): ReactElement<any, any> | null;

  toString(): string;

  readonly className: string;

  readonly selector: string;

  readonly style: Style<Variants>;
}

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
    <T extends React.ElementType = Tag>(
      {
        as: asType,
        children,
        className,
        css,
        tw: twProp,
        ...props
      }: PolymorphicPropsWithRef<Omit<StyleProps<Variants>, 'class'>, T>,
      ref: ForwardedRef<any>
    ) => {
      const tw = useContext(TwindContext);

      invariant(tw, 'Missing Twind context');

      const forwardedProps: any = {
        ...props,
        ref,
        className: dedupeClassNames(
          tw(
            base({
              className,
              css,
              tw: twProp,
              ...props,
            } as StyleProps<Variants>)
          )
        ),
      };

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
  return className;
  // return [...new Set(className.split(' '))].join(' ');
}
