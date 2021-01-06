# Nostalgie

![npm (scoped)](https://img.shields.io/npm/v/nostalgie?style=flat-square)
![NPM](https://img.shields.io/npm/l/nostalgie?style=flat-square)

Nostalgie is an opinionated, full-stack, runtime-agnostic framework for building web apps and web pages using [react](https://reactjs.org).

## Vision

Nostalgie removes many of the difficult, contentious decisions from the equation when building for the web. It aims to make it easier than ever to build server-side-rendered (SSR) apps that can be deployed anywhere and that take full advantage of modern facilities like:

- **Async SSR**: Idiomatic code-splitting using `React.lazy` that even works during SSR. You decide where you want to split things up using `React.lazy` and dynamic `import()` expressions and we wire things up so that it _just works_.
- **Routing**: Nested, hierarchical routing using [react-router v5](https://github.com/ReactTraining/react-router), letting you ship those glorious top-level page transitions you desperately wanted but couldn't get in your favourite react SSR framework.
- **SEO**: Full control over the top-level markup rendered by the server using an interface heavily inspired by [react-helmet](https://github.com/nfl/react-helmet). Set your title, meta tags and many others right from within your react components.
- **Styling**: Built-in integration with [tailwind.css](https://tailwindcss.com/) via [`twind`](https://github.com/tw-in-js/twind). Stop worrying about the hard parts of scalable CSS and catch the tropical breeze.
- **Serverless functions**: Expose functions that should run on the back-end directly to the front-end. You define your back-end function and call it directly from the front-end. We wire things up for you transparently. Want the result of these functions to be cacheable? Easy, return a `CacheableValue` from your server function and we'll worry about cacheing. We'll even figure out some smart HTTP cache headers to send automatically based on the cache-ability of all server functions invoked during server rendering so that your CDN can serve from _its cache_.
- **Authentication**: Built-in authentication with any OpenID-compliant service. We think that authentication and identity are a core building block of building any modern web site / app and want to take the complexities off your shoulders.

> *Note: Much of the above is very much an aspirational statement about what we want Nostalgie to be. Not all of this is build (or even designed). That being said, we feel strongly enough about it for it to be mentioned in the vision statement.*

## Usage

WIP: See `./example` for a real example.

## FAQ

### Why React?

While we do love alternative libraries (❤️ svelte), _no one ever got fired for choosing React_. This is where the ecosystem and the mind share lives right now. Using anything but React means both: 1) convincing people to use something other than React; and 2) convincing people to try Nostalgie. For now, we decided to focus on the biggest user-base with some ideas to branch out later.
