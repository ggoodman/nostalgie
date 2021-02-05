# Contributing to Nostalgie

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github

We use github to host code, to track issues and feature requests, as well as accept pull requests.

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
1. If your changes are user-facing, please document the changes.
1. Update the [Changelog](../CHANGELOG.md). We use [kacl](https://npm.im/kacl) to maintain the Changelog in the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.
1. We use [Prettier](https://npm.im/prettier) to format the code. Please run your changes through prettier (or let your IDE do it for you) before submitting your pull request.
1. Issue that pull request! ❤️

## TypeScript

We develop in TypeScript with strict mode enabled. We are not dogmatic about enforcing certain styles but make an effort for all user-facing types to be as helpful as possible. We aim to make the usage of types as unintrusive as possible.

1. We prefer APIs that are able to infer types over those that require author's to signal types via generics.
1. We prefer verbose and descriptive function and variable names over consision. 

## The Codebase

We develop in TypeScript with strict mode enabled. We are not dogmatic about enforcing certain styles but make an effort for all user-facing types to be as helpful as possible. We aim to make the usage of types as unintrusive as possible. We p There are two primary components to the Nostalgie codebase:

1. The CLI, builder and runtime modules in [`./src`](../src)
1. The build script in [`./scripts/build.js`](../scripts/build.js)

### The CLI

The CLI is built using [yargs](https://npm.im/yargs). We strive to make the CLI `--help` a useful source of documentation. Options and arguments should be well described. These should be mutually exclusive and collectively exhaustive.

The CLI is designed to be a lightweight layer between the user and the [Builder](#the-builder).

### The builder

Code that is designed specifically for the building phase of a Nostalgie app should be in the [`./src/build`](../src/build) directory.

The builder uses [https://npm.im/esbuild] as the primary tool for bundling and transforming user and library code. The builder is responsible for producing several main artifacts.

#### The Client

The client-side artifacts are those that are loaded and run in the browser. These are built by [`./src/build/builders/client.ts`](../src/build/builders/client.ts). Client-side artifacts are in ESM format (and other non-javascript formats as produced by different plugins and [`esbuild` loaders](https://esbuild.github.io/content-types/)) and are allocated among the main entrypoint and chunks by `esbuild`'s code-splitting mechanisms.
  
It is worth noting that there is some unusual logic being done in this build step to support the server-side and client-side dual nature of Nostalgie.

1. All references to the main "functions entrypoint" are replaced with a stub file. The contents of the stub file are informed by the [Functions Stub](#the-functions-stub) build. Essentially, all exports of the "functions entrypoint" are replaced with objects having a `name` property matching the name of the export. The client-side implementation of `useFunctionQuery` and `useFunctionMutation` make sure that the expected object exist and use the `name` property to issue the correct RPC call.

1. Imports to `react` are replaced with the "react shim" which replaces `React.lazy` with the Nostalgie implementation. The Nostalgie implementation is designed to allow seamless server and client-side coordination of loaded lazy chunks with the least overhead.

1. Deferred dynamic `import` calls of the form `() => import('./path')` are wrapped via RegExp (😱) in a call to `Object.assign()`. This adds metadata to the function itself that allow the Nostalgie version of `React.lazy` to work without any required work on behalf of the user.

The client build metadata is analyzed to build an understanding of synchronous and dynamic dependencies between chunks. This metadata is needed by [the server renderer](#the-server-renderer) builder as it is a constructor argument to the `ServerRenderer` class.

#### The Functions Stub

The functions stub builder doesn't actually produce anything that is stored to disk. The builder uses `esbuild` to analyze the "functions entrypoint" (if one is found) and surface exported symbols. This list will be used as an input to [the client builder](#the-client).

#### The Server Renderer

The server renderer builder is designed to produce a stand-alone CommonJS module that exports an instance of the [Server Renderer](../src/runtime/internal/renderer/renderer.tsx). The server renderer is passed a reference to the default export of the user's 'application entrypoint', a reference to the exports of the user's 'functions entrypoint' and the client-side module dependency graph. If the current project has no 'functions entrypoint', an empty object is passed in instead.

The server renderer is a fully self-contained bundle; all dependencies (including node modules) are bundled into this. This may need to change in the future if we see that users want to make use of binary modules in their 'server functions'.

> Note: Since server functions are bundled into this artifact, reliance on native modules (or anything that depends on file-system layout) is likely to break.

The server renderer builder instantiates the `ServerRenderer` and wires it up to [Workerpool](https://npm.im/workerpool) so that the instance's `invokeFunction` and `renderAppOnServer` methods are exposed for use in a worker pool.

#### The Node Server

The Node server is currently the only build target. It is designed to produce a [Hapi Server](https://npm.im/@hapi/hapi), a `package.json` and a `Dockerfile` for when the Nostalgie app should run in a container.

Right now, all of the authentication, session management and static asset serving is happening in the Hapi server.

This is likely to evolve as we explore building for alternate runtimes like AWS Lambda and Cloudflare Workers. In those cases, while it is possible to use Hapi's [`inject()`](https://hapi.dev/api/?v=20.1.0#-await-serverinjectoptions) API, it's not clear if this is the right direction. Hapi adds a lot of value to the project with static asset serving, amazing authentication and authorization capabilities and cookie management.

The Node server spins up the pool of workers and delegates RPC and server-side rendering (SSR) calls to them.

The Node server is also responsible for exposing a few 'magic endpoigns', such as:

- `.nostalgie/rpc` - The endpoint to which all client-side invocations of server-functions are routed. Having this route owned by Nostalgie means that the contract between the client and the server is owned by Nostalgie. Eventually, this contract will have to account for the rollout window of Nostalgie instances where some fraction of clients are on one version and the backend servers on another.

- `.nostalgie/login` - The endpoint that triggers an [OAuth 2.0 Authorization Flow](https://oauth.net/2/grant-types/authorization-code/) when Nostalgie is configured for OpenID-based authentication.

- `./nostalgie/callback` - The callback endpoint to which the Authorization Server will redirect during the Authorization Code Flow. This endpoint needs to be configured with your auth provider. For example, this can be done in the Application --> Settings tab in the Auth0 Dashboard or in the [Developper Settings](https://github.com/settings/developers) page on GitHub.

- `./nostalgie/logout` - An endpoint responsible for clearing the user's session. Currently, this doesn't attempt to do any OpenID session termination.

### The Runtime

The last part of the codebase is the Runtime. The Runtime is the set of modules exposed via `nostalgie/*` that are designed to be consumed by users building Nostalgie apps.

These runtime modules are designed to be a small set of primitives that we expect almost every app developer to need. If the developer doesn't need that particilar primitive, then it *should not contribute to client-side bundle sizes*.

These runtime modules are built by `esbuild` as a single code-split build with one entrypoint per runtime module. The build script makes sure that these modules are properly wired up in the top-level `package.json` `"exports"` map. Since these modules are also designed to be consumed by app builders, care is taken to produce type definitions at build-time.

Type definitions are currently produced by first doing a type-only `tsc --build` with an `outDir` of `./dist/.types`. We use [Rollup](https://rollupjs.org) and [rollup-plugin-dts](https://npm.im/rollup-plugin-dts) to produce tree-shaken type definitions for each runtime module.