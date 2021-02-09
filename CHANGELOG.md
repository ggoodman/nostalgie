# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Adjusted Server Function calls from the browser to collect invocations in a small window of time and issue a single http request for the entire batch. Implemented a streaming solution for reading back these responses (even out-of-order) so that Server Function calls can resolve as quickly as their outcome is available.

## [0.69.2] - 2021-02-08
### Changed
- Bumped dependencies:
  
  - `joi@17.4.0`
  - `react-query@3.8.2`

### Fixed
- Fixed obvious (in retrospect) XSS vector in using `JSON.stringify` to encode initial boostrap data into the initial html markup. This is corrected by using [`jsesc`](https://github.com/mathiasbynens/jsesc) to safely encode data for embedding in a script tag.

## [0.69.1] - 2021-02-06
### Changed
- Bumped dependencies:
  
  - `react-query` to `3.8.0`.
  - `blob-polyfill` to `5.0.20210201`

## [0.69.0] - 2021-02-06
### Added
- Added `create-nostalgie-app`, the easiest way to scaffold out a new Nostalgie project.
  
  With a simple `npx create-nostalgie-app my-app` you have a fully-functioning Nostalgie app in less than 30 seconds.

### Changed
- Increased logging during build and forced clean exit upon completion.
  
  There is some, as-yet-unknown handle keeping Node's event loop alive. To work around that, we're forcing exit via `process.exit(0)` when the build completes.
- Switch to requirin `npm@7` during development to prepare for using workspaces.

## [0.68.5] - 2021-02-05
### Fixed
- Run `npm publish` correctly in `./dist`.

## [0.68.4] - 2021-02-05
### Added
- Added detailed [Contribution guidelines](./docs/Contributing.md) to help newcomers get acquainted with Nostalgie's architecture and codebase.
- Publish releases of Nostalgie automatically, triggered by GitHub releases.

### Changed
- Renamed `nostalgie/internal/server` to `nostalgie/internal/renderer` to better reflect purpose.

## [0.68.3] - 2021-02-04
### Added
- Add `"pakage.json"` as an explicit export in the package's export map. This makes it easier for tooling authors to identify the root of the locally-installed version of `nostalgie` and to figure out the modules' dependencies and version.
- Bumped dependencies to latest within semver range.

## [0.68.2] - 2021-02-02
### Fixed
- Moved required typedef dependencies to the `"dependencies"` field and added `"peerDependencies"` for `@types/react` and `@types/react-dom`.

## [0.68.1] - 2021-02-02
### Fixed
- Re-added `devDependencies` for packages like `@mdx-js/react` whose types are dependended upon by nostalgie packages / compiled types.

## [0.68.0] - 2021-02-01
### Added
- Introduce `nostalgie/styling` as a module through-which to deliver a styled-components-like experience. Right now, this is built on `twind` and `twind/css`. (#12)
  
  This PR introduces support for (typed) styling of intrinsic HTML elements _a la_ `styled-components` with both the factory and explicit apis, respectively:
  
  ```ts
  import { styled } from 'nostalgie/styling';
  
  const Button = styled.button`
    border: 1px solid rebeccapurple;
  `;
  ```
  
  ```ts
  import { styled } from 'nostalgie/styling';
  
  const Button = styled('button')`
    border: 1px solid rebeccapurple;
  `;
  ```
  
  Additionally, object syntaxes are supported, like:
  
  ```ts
  import { styled } from 'nostalgie/styling';
  
  const Button = styled({
    border: '1px solid rebeccapurple',
  });
  ```
- React JSX files no longer need to `import * as React from 'react'` as this will be injected automatically. Importing react in this way will have no harmful side-effects and may be considered optional. (#12)

### Changed
- **[BREAKING]** The automatic tailwindcss styling will only be enabled when a `tailwind.config.js` file is found in the root of the project. (#12)

## [0.67.3] - 2021-01-28
### Changed
- Bump `twind` from `0.12` to `0.14` and adjust internals accordingly.

### Fixed
- Removed unused dependencies and build slimmer dist.

## [0.67.2] - 2021-01-28
### Fixed
- Copy the `./src/themes/OneDark.json` theme file into the `./dist/themes/` folder at build time so that it is readable by the mdx compilation worker at build-time.

## [0.67.1] - 2021-01-28
### Fixed
- Mark `@mdx-js/react` and `workerpool` modules as install-time dependencies because we rely on being able to `require.resolve()` their files at build-time.

## [0.67.0] - 2021-01-28
### Added
- Improved the internal wiring of the build pipeline so that no unnecessary work is performed and so that work will be running at maximum concurrency. (#10)
- Add support for automatic browser reloads in `nostalgie dev`. This isn't 'hot reloading' (yet) but nevertheless provides a huge boost to developer ergonomics. (#10)
  
  To opt out:
  
  ```bash
  nostalgie dev --disable-hot-reload
  ```
- Introduce the `--log-level` flag for `nostalgie dev` and `nostalgie build`. (#10)

### Changed
- When authentication is configured, the cookies used to persiste ephemeral and long-lived session state will now always be `Secure` in production.
  
  More precisely, whenever `process.env.NODE_ENV` is not `"development"`, cookies will always be set with the `Secure` flag.

## [0.66.0] - 2021-01-27
### Added
- Added authentication support to nostalgie via the `nostalgie/auth` sub-package. (#7)
  
  Nostalgie authentication currently provides for:
  
  1. Authentication via OpenID-compliant providers via the code flow.
  2. Both `/.nostalgie/login?return_to` and `/.nostalgie/logout?return_to` endpoints for logging in and logging out, respectively.
  3. Authentication state is exposed to server functions in the first, `ctx` argument via the `.auth` property. High-level authentication status can be checked via `ctx.auth.isAuthenticated` and when the user is authenticated, their authentication details can be found on `ctx.auth.credentials.user`, `ctx.auth.credentials.scope` and `ctx.auth.credentials.claims`.
  4. Authentication state is exposed to the front-end application via the `useAuth()` hook exported from `nostalgie/auth`. This hook returns the same form of authentication state as `ctx.auth` in server functions. It can be used, for example, to render a user avatar or make decisions about which routes are available to users.
  
  To configure authentication, the following environment variables must either all be set or none must be set (in which case the auth module is disabled):
  
  `AUTH_ISSUER` - The OpenID issuer url, such as https://nostalgie.us.auth0.com. This URL will be used for automatic OpenID Connect discovery for further authentication configuration.
  `AUTH_CLIENT_ID` - The OpenID client identifier for the application ('client') configured for your Nostalgie app.
  `AUTH_CLIENT_SECRET` - The OpenID client secret for the application ('client') configured for your Nostalgie app. This is important to keep well protected. It will never be exposed to the front-end.
  `AUTH_COOKIE_SECRET` - The secret used to encrypt session state in an [Iron](https://npm.im/@hapi/iron)-encoded token.
- Added support for importing `.css` files from JavaScript files. (#8)
  
  Previously the return value of such imports was the url at which the generated CSS file could be found. The ergonomics of this were sub par; it wasn't possible to get Nostalgie to include these files in the initial page render so either there was a FOUC or a slower experience.
  
  The community appears to have settled on the convention that importing a `.css` file should have the _side-effect_ of causing that css to be injected into the DOM. Nostalgie picks up on this convention and will inject the CSS at runtime for lazy-loaded chunks and will inject the CSS during SSR for chunks referenced in routes activated by the current path.
  
  Usage:
  
  ```js
  // Cause the styles in 'style.css' to be loaded into the DOM at the earlier of:
  //   1. SSR page generation when the importing file is referenced in the initial route.
  //   2. Immediately once a lazy chunk is loaded via `.lazy()`.
  import from './style.css';
  ```

## [0.65.1] - 2021-01-22
### Fixed
- Fixed repo name lingering from when forking from https://github.com/ggoodman/typescript-library-template

## 0.65.0 - 2021-01-22
### Added
- Created a changelog adhering to [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).
- Introduced [`kacl`](https://npm.im/@brightcove/kacl) as a mechanism to lint and manage the changelog.
- Introduced [`gh-release`](https://npm.im/gh-release) to produce releases on GitHub.

[Unreleased]: https://github.com/ggoodman/nostalgie/compare/v0.69.2...HEAD
[0.69.2]: https://github.com/ggoodman/nostalgie/compare/v0.69.1...v0.69.2
[0.69.1]: https://github.com/ggoodman/nostalgie/compare/v0.69.0...v0.69.1
[0.69.0]: https://github.com/ggoodman/nostalgie/compare/v0.68.5...v0.69.0
[0.68.5]: https://github.com/ggoodman/nostalgie/compare/v0.68.4...v0.68.5
[0.68.4]: https://github.com/ggoodman/nostalgie/compare/v0.68.3...v0.68.4
[0.68.3]: https://github.com/ggoodman/nostalgie/compare/v0.68.2...v0.68.3
[0.68.2]: https://github.com/ggoodman/nostalgie/compare/v0.68.1...v0.68.2
[0.68.1]: https://github.com/ggoodman/nostalgie/compare/v0.68.0...v0.68.1
[0.68.0]: https://github.com/ggoodman/nostalgie/compare/v0.67.3...v0.68.0
[0.67.3]: https://github.com/ggoodman/nostalgie/compare/v0.67.2...v0.67.3
[0.67.2]: https://github.com/ggoodman/nostalgie/compare/v0.67.1...v0.67.2
[0.67.1]: https://github.com/ggoodman/nostalgie/compare/v0.67.0...v0.67.1
[0.67.0]: https://github.com/ggoodman/nostalgie/compare/v0.66.0...v0.67.0
[0.66.0]: https://github.com/ggoodman/nostalgie/compare/v0.65.1...v0.66.0
[0.65.1]: https://github.com/ggoodman/nostalgie/compare/v0.65.0...v0.65.1
