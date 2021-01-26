# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added authentication support to nostalgie via the `nostalgie/auth` sub-package. Nostalgie authentication currently provides for:
  
  1. Authentication via OpenID-compliant providers via the code flow.
  2. Both `/.nostalgie/login?return_to` and `/.nostalgie/logout?return_to` endpoints for logging in and logging out, respectively.
  3. Authentication state is exposed to server functions in the first, `ctx` argument via the `.auth` property. High-level authentication status can be checked via `ctx.auth.isAuthenticated` and when the user is authenticated, their authentication details can be found on `ctx.auth.credentials.user`, `ctx.auth.credentials.scope` and `ctx.auth.credentials.claims`.
  4. Authentication state is exposed to the front-end application via the `useAuth()` hook exported from `nostalgie/auth`. This hook returns the same form of authentication state as `ctx.auth` in server functions. It can be used, for example, to render a user avatar or make decisions about which routes are available to users.
  
  To configure authentication, the following environment variables must either all be set or none must be set (in which case the auth module is disabled):
  
  `AUTH_ISSUER` - The OpenID issuer url, such as https://nostalgie.us.auth0.com. This URL will be used for automatic OpenID Connect discovery for further authentication configuration.
  `AUTH_CLIENT_ID` - The OpenID client identifier for the application ('client') configured for your Nostalgie app.
  `AUTH_CLIENT_SECRET` - The OpenID client secret for the application ('client') configured for your Nostalgie app. This is important to keep well protected. It will never be exposed to the front-end.
  `AUTH_COOKIE_SECRET` - The secret used to encrypt session state in an [Iron](https://npm.im/@hapi/iron)-encoded token.

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
