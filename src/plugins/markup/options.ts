import type { HTMLAttributeReferrerPolicy } from 'react';

export interface MarkupOptions {
  lang?: string;
  links?: LinkTagDescription[];
  meta?: MetaTagDescription;
  title?: string;
}

export interface LinkTagDescription {
  as?: string;
  crossOrigin?: string;
  href?: string;
  hrefLang?: string;
  integrity?: string;
  media?: string;
  imageSrcSet?: string;
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  rel?: string;
  sizes?: string;
  type?: string;
  charSet?: string;
}

export interface MetaTagDescription {
  charset?: Suggest<'utf-8'>;
  'http-equiv'?: MetaHttpEquiv;
  names?: MetaNameMap | Record<string, string>;
  properties?: PropertyNameMap | Record<string, string>;
}

export interface MetaNameMap {
  // HTML Specification

  /**
   * The name of the document's author.
   */
  author?: string;

  /**
   * A short and accurate summary of the content of the page. Several browsers, like
   * Firefox and Opera, use this as the default description of bookmarked pages.
   */
  description?: string;

  /**
   * The identifier of the software that generated the page.
   */
  generator?: string;

  /**
   * Words relevant to the page's content separated by commas.
   */
  keywords?: string;

  /**
   * Controls the HTTP `Referer` header of requests sent from the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#standard_metadata_names_defined_in_the_html_specification
   */
  referrer?:
    | /** Do not send a HTTP Referer header */ 'no-referrer'
    | 'origin' //	Send the origin of the document.
    | 'no-referrer-when-downgrade' // Send the full URL when the destination is at least as secure as the current page (HTTP(S)→HTTPS), but send no referrer when it's less secure (HTTPS→HTTP). This is the default behavior.
    | 'origin-when-cross-origin' // Send the full URL (stripped of parameters) for same-origin requests, but only send the origin for other cases.
    | 'same-origin' // Send the full URL (stripped of parameters) for same-origin requests. Cross-origin requests will contain no referrer header.
    | 'strict-origin' //Send the origin when the destination is at least as secure as the current page (HTTP(S)→HTTPS), but send no referrer when it's less secure (HTTPS→HTTP).
    | 'strict-origin-when-cross-origin' //	Send the full URL (stripped of parameters) for same-origin requests. Send the origin when the destination is at least as secure as the current page (HTTP(S)→HTTPS). Otherwise, send no referrer.
    | 'unsafe-URL'; // Send the full URL (stripped of parameters) for same-origin or cross-origin requests.

  /**
   * Indicates a suggested color that user agents should use to customize the display of
   * the page or of the surrounding user interface. The content attribute contains a valid
   * CSS <color>.
   */
  'theme-color'?: string;

  /**
   * Specifies one or more color schemes with which the document is compatible. The
   * browser will use this information in tandem with the user's browser or device
   * settings to determine what colors to use for everything from background and
   * foregrounds to form controls and scrollbars. The primary use for `<meta
   * name="color-scheme">` is to indicate compatibility with—and order of preference
   * for—light and dark color modes.
   */
  'color-scheme'?:
    | 'normal'
    | 'light'
    | 'dark'
    | 'light dark'
    | 'dark light'
    | 'only light';

  //  CSS Device Adaptation Specification

  /**
   * Gives hints about the size of the initial size of the viewport.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#:~:text=following%20metadata%20name%3A-,viewport,-%3A%20gives%20hints%20about
   */
  viewport?: MetaViewPort;

  //
  // Non-standard
  //

  /**
   * The name of the creator of the document, such as an organization or institution. If
   * there are more than one, several `<meta>` elements should be used.
   */
  creator?: string[];

  /**
   * a synonym of `robots`, is only followed by Googlebot
   * (the indexing crawler for Google).
   */
  googlebot?: string;

  /**
   * The name of the document's publisher.
   */
  publisher?: string;

  /**
   * The behavior that cooperative crawlers, or "robots", should use with the page.
   */
  robots?: RobotsText;
}

export interface MetaViewPort {
  /**
   * Defines the pixel width of the viewport that you want the web site to be rendered at.
   */
  width?: Suggest<'device-width'>;

  /**
   * Defines the height of the viewport. Not used by any browser.
   */
  height?: Suggest<'device-height'>;

  /**
   * Defines the ratio between the device width (device-width in portrait mode or
   * device-height in landscape mode) and the viewport size.
   *
   * *Note: Must be a positive number between `0.0` and `10.0`.*
   */
  'initial-scale'?: string;

  /**
   * Defines the maximum amount to zoom in. It must be greater or equal to the
   * `minimum-scale` or the behavior is undefined. Browser settings can ignore this rule
   * and iOS10+ ignores it by default.
   *
   * *Note: Must be a positive number between `0.0` and `10.0`.*
   */
  'maximum-scale'?: string;

  /**
   * Defines the minimum zoom level. It must be smaller or equal to the `maximum-scale` or
   * the behavior is undefined. Browser settings can ignore this rule and iOS10+ ignores
   * it by default.
   *
   * *Note: Must be a positive number between `0.0` and `10.0`.*
   */
  'minimum-scale'?: number;

  /**
   * If set to no, the user is not able to zoom in the webpage. The default is yes.
   * Browser settings can ignore this rule, and iOS10+ ignores it by default.
   */
  'user-scalable'?: 'yes' | 'no';

  /**
   * Defines how the initial layout viewport should be scaled.
   *
   * The `auto` value doesn't affect the initial layout viewport, and the whole web page
   * is viewable.
   *
   * The `contain` value means that the viewport is scaled to fit the largest rectangle
   * inscribed within the display.
   *
   * The `cover` value means that the viewport is scaled to fill the device display. It is
   * highly recommended to make use of the safe area inset variables to ensure that
   * important content doesn't end up outside the display.
   */
  'viewport-fit'?: 'auto' | 'contain' | 'cover';
}

export interface MetaHttpEquiv {
  /**
   * Allows page authors to define a content policy for the current page. Content policies
   * mostly specify allowed server origins and script endpoints which help guard against
   * cross-site scripting attacks.
   */
  'content-security-policy'?: string;

  /**
   * Declares the MIME type and character encoding of the document. If specified, the
   * `content` attribute must have the value "text/html; charset=utf-8". This is
   * equivalent to a <meta> element with the charset attribute specified, and carries the
   * same restriction on placement within the document. Note: Can only be used in
   * documents served with a text/html — not in documents served with an XML MIME type.
   */
  'content-type'?: Suggest<'text/html; charset=utf-8'>;
}

type Suggest<T extends string> = T | ({} & string);

type RobotsKeywords =
  | 'index' //	Allows the robot to index the page (default).	All
  | 'noindex' //	Requests the robot to not index the page.	All
  | 'follow' //	Allows the robot to follow the links on the page (default).	All
  | 'nofollow' //	Requests the robot to not follow the links on the page.	All
  | 'all' //	Equivalent to index, follow	Google
  | 'none' //	Equivalent to noindex, nofollow	Google
  | 'noarchive' //	Requests the search engine not to cache the page content.	Google, Yahoo, Bing
  | 'nosnippet' //	Prevents displaying any description of the page in search engine results.	Google, Bing
  | 'noimageindex' //	Requests this page not to appear as the referring page of an indexed image.	Google
  | 'nocache'; //	Synonym of noarchive.	Bing

type RobotsText = Suggest<UnionConcat<RobotsKeywords, ','>>;

export interface PropertyNameMap {
  //
  // Basic metadata
  //

  /**
   * The title of your object as it should appear within the graph, e.g., "The Rock".
   */
  'og:title'?: string;
  /**
   * The type of your object, e.g., "video.movie". Depending on the type you specify, other properties may also be required.
   */
  'og:type'?: string;
  /**
   * An image URL which should represent your object within the graph.
   */
  'og:image'?: string;
  /**
   * The canonical URL of your object that will be used as its permanent ID in the graph, e.g., "https://www.imdb.com/title/tt0117500/".
   */
  'og:url'?: string;

  //
  // Optional metadata
  //
  /**
   * A URL to an audio file to accompany this object.
   */
  'og:audio'?: string;
  /**
   * A one to two sentence description of your object.
   */
  'og:description'?: string;
  /**
   * The word that appears before this object's title in a sentence. An enum of (a, an, the, "", auto). If auto is chosen, the consumer of your data should chose between "a" or "an". Default is "" (blank).
   */
  'og:determiner'?: string;
  /**
   * The locale these tags are marked up in. Of the format language_TERRITORY. Default is en_US.
   */
  'og:locale'?: string;
  /**
   * An array of other locales this page is available in.
   */
  'og:locale:alternate'?: string[];
  /**
   * If your object is part of a larger web site, the name which should be displayed for the overall site. e.g., "IMDb".
   */
  'og:site_name'?: string;
  /**
   * A URL to a video file that complements this object.
   */
  'og:video'?: string;
}

// Copyright StackOverflow users `mh-alahdadian`
// https://stackoverflow.com/a/65157132/3753599
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
type UnionToOvlds<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;

type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

type UnionConcat<
  U extends string,
  Sep extends string
> = PopUnion<U> extends infer SELF
  ? SELF extends string
    ? Exclude<U, SELF> extends never
      ? SELF
      :
          | `${UnionConcat<Exclude<U, SELF>, Sep>}${Sep}${SELF}`
          | UnionConcat<Exclude<U, SELF>, Sep>
          | SELF
    : never
  : never;
