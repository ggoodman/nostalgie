import type { LinkOptions, MetaOptions, ScriptOptions } from 'hoofd';
import { useLang, useLink, useMeta, useScript, useTitle, useTitleTemplate } from 'hoofd';
import React from 'react';

export { useLang, useLink, useMeta, useScript, useTitle, useTitleTemplate };

export interface HtmlProps {
  lang?: string;
  link?: LinkOptions[];
  meta?: MetaOptions[];
  script?: ScriptOptions[];
  title?: string;
  titleTemplate?: string;
}

export function Html(props: HtmlProps) {
  return React.createElement(
    React.Fragment,
    null,
    props.lang && React.createElement(() => (useLang(props.lang!), null)),
    ...(props.link
      ? props.link.map((link) => React.createElement(() => (useLink(link), null)))
      : []),
    ...(props.meta
      ? props.meta.map((meta) => React.createElement(() => (useMeta(meta), null)))
      : []),
    ...(props.script
      ? props.script.map((script) => React.createElement(() => (useScript(script), null)))
      : []),
    props.title && React.createElement(() => (useTitle(props.title!), null)),
    props.titleTemplate && React.createElement(() => (useTitleTemplate(props.titleTemplate!), null))
  );
}
