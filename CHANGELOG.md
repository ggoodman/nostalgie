# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
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

[Unreleased]: https://github.com/ggoodman/nostalgie/compare/v0.65.1...HEAD
[0.65.1]: https://github.com/ggoodman/nostalgie/compare/v0.65.0...v0.65.1
