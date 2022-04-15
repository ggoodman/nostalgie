import type {
  Attributes,
  CElement,
  ClassAttributes,
  ClassicComponent,
  ClassicComponentClass,
  ClassType,
  Component,
  ComponentClass,
  ComponentState,
  DetailedReactHTMLElement,
  DOMAttributes,
  DOMElement,
  FunctionComponent,
  FunctionComponentElement,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactHTML,
  ReactNode,
  ReactSVG,
  ReactSVGElement,
  SVGAttributes,
} from 'react';
import { createElement, useContext } from 'react';
import type { Style, StyleConfig, StyleProps } from 'twind/style';
import { style } from 'twind/style';
import { invariant } from '../../../../invariant';
import { TwindContext } from './context';

export function useTwind() {
  const tw = useContext(TwindContext);

  invariant(tw, "Did you forget to install the 'nostalgie/twind' plugin?");

  return tw;
}

type FirstParameter<T extends (...args: any) => any> = T extends (
  head: infer H,
  ...args: any
) => any
  ? H
  : never;
type RestParameters<T extends (...args: any) => any> = T extends (
  head: any,
  ...args: infer R
) => any
  ? R
  : never;

type WithVariants<Variants, T> = T & { style: Style<Variants> } & string;

type VariantsOfStyled<T> = T extends { style: Style<infer Variants> }
  ? Variants
  : never;

// Composition

export function styled<Variants, Base extends ReturnType<typeof styled>>(
  type: Base,
  config?: StyleConfig<Variants, VariantsOfStyled<Base>>
): WithVariants<
  Variants,
  (
    props: FirstParameter<Base> & StyleProps<Variants>,
    ...rest: RestParameters<Base>
  ) => ReturnType<Base>
>;

// DOM Elements

export function styled<Variants>(
  type: 'input',
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?:
      | (StyleProps<Variants> &
          InputHTMLAttributes<HTMLInputElement> &
          ClassAttributes<HTMLInputElement>)
      | null,
    ...children: ReactNode[]
  ) => DetailedReactHTMLElement<
    InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >
>;
export function styled<
  Variants,
  P extends HTMLAttributes<T>,
  T extends HTMLElement
>(
  type: keyof ReactHTML,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & ClassAttributes<T> & P) | null,
    ...children: ReactNode[]
  ) => DetailedReactHTMLElement<P, T>
>;
export function styled<
  Variants,
  P extends SVGAttributes<T>,
  T extends SVGElement
>(
  type: keyof ReactSVG,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & ClassAttributes<T> & P) | null,
    ...children: ReactNode[]
  ) => ReactSVGElement
>;
export function styled<Variants, P extends DOMAttributes<T>, T extends Element>(
  type: string,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & ClassAttributes<T> & P) | null,
    ...children: ReactNode[]
  ) => DOMElement<P, T>
>;

// Custom components

export function styled<Variants, P extends {}>(
  type: FunctionComponent<P>,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & Attributes & P) | null,
    ...children: ReactNode[]
  ) => FunctionComponentElement<P>
>;
export function styled<Variants, P extends {}>(
  type: ClassType<
    P,
    ClassicComponent<P, ComponentState>,
    ClassicComponentClass<P>
  >,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?:
      | (StyleProps<Variants> &
          ClassAttributes<ClassicComponent<P, ComponentState>> &
          P)
      | null,
    ...children: ReactNode[]
  ) => CElement<P, ClassicComponent<P, ComponentState>>
>;
export function styled<
  Variants,
  P extends {},
  T extends Component<P, ComponentState>,
  C extends ComponentClass<P>
>(
  type: ClassType<P, T, C>,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & ClassAttributes<T> & P) | null,
    ...children: ReactNode[]
  ) => CElement<P, T>
>;
export function styled<Variants, P extends {}>(
  type: FunctionComponent<P> | ComponentClass<P> | string,
  config?: StyleConfig<Variants>
): WithVariants<
  Variants,
  (
    props?: (StyleProps<Variants> & Attributes & P) | null,
    ...children: ReactNode[]
  ) => ReactElement<P>
>;

export function styled<Variants>(type: any, config?: StyleConfig<Variants>) {
  const base =
    type != null && type.base ? style(type.base, config) : style(config);

  return Object.defineProperties(
    function Styled(props: any): any {
      const tw = useTwind();
      const variantProps: StyleProps<Variants> = {};

      if (config?.variants && props != null) {
        for (const key in config.variants) {
          variantProps[key] = props[key];
        }
      }

      const classNames = `${tw(base(variantProps))} ${
        props?.className ?? ''
      }`.trim();
      return createElement(type, {
        ...props,
        className: classNames,
      });
    },
    {
      style: {
        value: base,
      },
      toString: {
        get() {
          return base.toString;
        },
      },
    }
  );
}
