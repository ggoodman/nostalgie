import * as React from 'react';
import reactFastCompare from 'react-fast-compare';
import { invariant } from '../invariant';
import { TAG_NAMES } from './constants';

export class MarkupCollector {
  private readonly records: Array<{ refInstance: {}; state: MarkupState }> = [];

  get state() {
    const flattenedState: MarkupState = {};

    for (const { state } of this.records) {
      const stateKeys = Object.keys(state) as Array<keyof MarkupState>;

      for (const field of stateKeys) {
        if (isMarkupArrayType(field)) {
          flattenedState[field] ??= [];
          flattenedState[field] = state[field] as any;
        } else if (isMarkupObjectType(field)) {
          flattenedState[field] ??= {};
          Object.assign(flattenedState[field], state[field]);
        }
      }
    }

    return flattenedState;
  }

  private createRemoveCallback(record: { refInstance: {}; state: MarkupState }) {
    return () => {
      const idx = this.records.indexOf(record);

      if (idx >= 0) {
        this.records.splice(idx, 1);
      }
    };
  }

  report(refInstance: {}, state: MarkupState) {
    let record = this.records.find((record) => record.refInstance === refInstance);

    if (!record) {
      record = { refInstance, state };
      this.records.push({ refInstance, state });
    } else {
      record.state = state;
    }

    return this.createRemoveCallback(record);
  }
}

export const MarkupContext = React.createContext<MarkupCollector | undefined>(undefined);

type MaybeArray<T> = T | Array<T>;

export type MarkupState = {
  [T in MarkupArrayType]?: JSX.IntrinsicElements[T][];
} &
  {
    [T in MarkupObjectType]?: JSX.IntrinsicElements[T];
  };

type MarkupChild =
  | React.ReactElement<JSX.IntrinsicElements['base'], 'base'>
  | React.ReactElement<JSX.IntrinsicElements['body'], 'body'>
  | React.ReactElement<JSX.IntrinsicElements['html'], 'html'>
  | React.ReactElement<JSX.IntrinsicElements['link'], 'link'>
  | React.ReactElement<JSX.IntrinsicElements['meta'], 'meta'>
  | React.ReactElement<JSX.IntrinsicElements['noscript'], 'noscript'>
  | React.ReactElement<JSX.IntrinsicElements['script'], 'script'>
  | React.ReactElement<JSX.IntrinsicElements['style'], 'style'>
  | React.ReactElement<JSX.IntrinsicElements['title'], 'title'>
  | {
      type: TAG_NAMES.FRAGMENT;
      props: { children?: MarkupChildren };
      key: React.Key | null;
    };
type MarkupChildren = MaybeArray<MarkupChild>;
type MarkupArrayType = 'link' | 'meta' | 'noscript' | 'script' | 'style';
export const markupArrayType = new Set(['link', 'meta', 'noscript', 'script', 'style']);
export const isMarkupArrayType = (type: string): type is MarkupArrayType =>
  markupArrayType.has(type);
type MarkupObjectType = 'base' | 'body' | 'html' | 'title';
export const markupObjectType = new Set(['base', 'body', 'html', 'title']);
export const isMarkupObjectType = (type: string): type is MarkupObjectType =>
  markupObjectType.has(type);

export type MarkupTagType = MarkupArrayType | MarkupObjectType;

export interface MarkupProps {
  children?: MarkupChildren;
}

export function Markup(props: MarkupProps = {}) {
  const identityRef = React.useRef({});
  const lastProps = React.useRef<MarkupProps>({});
  const cleanUpRef = React.useRef<undefined | (() => void)>();
  const collector = React.useContext(MarkupContext);

  invariant(collector, `Expected an ancestor to provide the MarkupContext`);

  if (!reactFastCompare(lastProps.current, props)) {
    cleanUpRef.current = collector.report(identityRef.current, mapChildrenToProps(props.children));
  }

  React.useEffect(() => cleanUpRef.current, [cleanUpRef.current]);

  return null;
}

function mapChildrenToProps(
  children?: MarkupChildren,
  initialProps: MarkupState = {}
): MarkupState {
  let mappedProps = { ...initialProps };

  React.Children.forEach(children, (child) => {
    if (!child || !child.props) {
      return;
    }

    switch (child.type) {
      case TAG_NAMES.FRAGMENT:
        mappedProps = mapChildrenToProps(child.props.children!, mappedProps);
        break;

      case TAG_NAMES.LINK:
      case TAG_NAMES.META:
      case TAG_NAMES.NOSCRIPT:
      case TAG_NAMES.SCRIPT:
      case TAG_NAMES.STYLE:
        mappedProps = {
          ...mappedProps,
          [child.type]: [...(mappedProps[child.type] || []), child.props],
        };
        break;

      default:
        mappedProps = {
          ...mappedProps,
          [child.type]: {
            ...mappedProps[child.type],
            ...child.props,
          },
        };
        break;
    }
  });

  return mappedProps;
}
