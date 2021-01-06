import * as React from 'react';

type ChildrenTypes = React.ReactElement<JSX.IntrinsicElements[ChildType], ChildType>;

type ChildType = 'link' | 'title';
type ChildElement<T extends ChildType> = React.ReactElement<JSX.IntrinsicElements[T], T>;

export const HeadContext = React.createContext<HeadState>({
  links: [],
  title: '',
});

export function Head(props: { children?: ChildrenTypes }) {
  const state = React.useContext(HeadContext);
  const children = React.Children.toArray(props.children) as ChildrenTypes[];

  for (const child of children) {
    const childType = child.type;

    switch (childType) {
      case 'link':
        const typedChild: ChildElement<'link'> = child as any;
        state.links.push({ href: typedChild.props.href!, rel: typedChild.props.rel! });
        return;
      case 'title': {
        const typedChild: ChildElement<'title'> = child as any;

        if (typeof typedChild.props.children === 'string') {
          state.title = typedChild.props.children;
        }
        return;
      }
    }
  }

  return <></>;
}

interface Link {
  rel: string;
  href: string;
}

interface HeadState {
  links: Link[];
  title: string;
}
