import * as React from 'react';
import withSideEffect from 'react-side-effect';

type OneOrMore<T> = T | Array<T>;

type ChildrenTypes = React.ReactElement<JSX.IntrinsicElements['link' | 'title'], 'link' | 'title'>;

interface HeadProps {
  children?: OneOrMore<ChildrenTypes>;
}

export const Head = withSideEffect(
  reducePropsToState,
  handleStateChangeOnClient,
  mapStateOnServer
)(() => <></>);

function reducePropsToState(propList: HeadProps[]) {
  const state = {
    title: '',
  };

  for (const props of propList) {
    React.Children.forEach(props.children, (child) => {
      if (!child) {
        return;
      }
      switch (child.type) {
        case 'link':
          return;
        case 'title': {
          if (typeof child.props.children === 'string') {
            state.title = child.props.children;
          }
          return;
        }
      }
    });
  }
  return state;
}

function handleStateChangeOnClient() {}

function mapStateOnServer() {}
