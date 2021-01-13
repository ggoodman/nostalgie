# Nostalgie

![npm (scoped)](https://img.shields.io/npm/v/nostalgie?style=flat-square)
![NPM](https://img.shields.io/npm/l/nostalgie?style=flat-square)

Nostalgie is an opinionated, full-stack, runtime-agnostic framework for building web apps and web pages using [react](https://reactjs.org).

See below for our [Vision](#Vision).

## Getting started

### Installing `nostalgie`

We can install it globally to keep things simple. The main entrypoint is a CLI called `nostalgie`.

```sh
npm install -g nostalgie
```

Alternatively, we can use `npx nostalgie` anywhere you see us calling `nostalgie` directly below.

### Project structure

For now, `nostalgie` doesn't provide any tooling to help scaffold out a project and makes some assumptions about how your project should be structured. Later, we plan to add the ability to allow projects to configure the structure.

#### Application entrypoint

> **Default: `./src/App.[jsx|tsx]`**
>
> _Note: This file must exist._

Nostalgie expects to find a `./src/App.[jsx|tsx]` file that it will treat as the only entrypoint into your application. It uses `react-router` behind the scenes to unify front- and back-end routing. Nostalgie is _NOT_ organized on the basis of filesystem routing. Instead, it is expected that your application entrypoint makes all routing decisions.

For example, if you want `/` (home) and `/docs` (docs) routes, you might have an `./src/App.tsx` file like the following. In this example, we've effectively declared two routes and have code-splitting supported between them but we're not married to that sort of thinking.

```tsx
import { Switch, Route } from 'nostalgie';
import * as React from 'react';

const LazyDocsPage = React.lazy(() => import('./pages/Docs'));
const LazyHomePage = React.lazy(() => import('./pages/Home'));

export default function App() {
  return (
    <Switch>
      <Route exact path="/">
        <LazyHomePage />
      </Route>
      <Route path="/docs">
        <LazyDocsPage />
      </Route>
    </Switch>
  );
}
```

#### Functions entrypoint

> **Default: `./src/functions.[js|ts]`**
>
> _Note: This file must exist._

In Nostalgie, invoking server-side code has never been easier. Nostalgie abstracts away the complexity of invoking server-side logic from the frontend in a way that these functions can be called either at runtime in the browser, or at render-time on the server.

Creating an exposing a function to your application code is as simple as defining and exporting a function. All server functions _must_ be exported by the functions entrypoint but their actual logic can be imported from other files. You can structure this as you choose.

Authentication is not yet implemented but the `ctx` argument is already wired up and this will be the place where identity metadata will be made available.

```ts
import type { ServerFunctionContext } from 'nostalgie';

const posts = {
  {
    id: 1,
    title: 'Introducing Nostalgie',
    body: '...',
    author: 'ggoodman'
  },
  {
    id: 2,
    title: 'Introducing MDX support',
    body: '...',
    author: 'cooldood42',
  }
}

export function getBlogPosts(ctx: ServerFunctionContext, author?: string) {
  return author ? posts.filter(post => post.author = author) : posts;
}
```

If we want to use this function from our application code, we use the `useFunction` hook exposed by `nostalgie`. Note that we also import a reference to the _actual_ function. This might sound surprising because that function often won't be able to execute in the browser context. In fact, we probably don't want it and its dependencies increasing the size of our front-end bundle(s). Have no fear, since Nostalgie is also responsible for packaging applications, it will actually replace the functions entrypoint (and any transient dependencies) with a simple object providing the metadata about which functions exist. Importing a reference to the actual function also has the side benefit of helping us get accurate type hints. When using `useFunction` below, we will be hinted with the names and types of the arguments array. We will also have full type hinting for the `blogPosts` value.

Behind the scenes, the `useFunction` hook is delegating to [`useQuery`](https://react-query.tanstack.com/reference/useQuery) from [react-query](https://github.com/tannerlinsley/react-query). As a result, the returned `blogPosts` object is an observer of the query. In fact, we could have provided a third argument to `useFunction` to set caching and other options as supported by [`useQuery`](https://react-query.tanstack.com/reference/useQuery).

```tsx
import * as React from 'react';
import { useFunction } from 'nostalgie';
import BlogPost from './BlogPost';
import { getBlogPosts } from './functions';

export default function BlogPostList() {
  const blogPosts = useFunction(getBlogPosts, ['ggoodman']);

  if (blogPosts.isLoading) return 'Loading...';

  if (blogPosts.error) return 'An error has occurred: ' + blogPosts.error.message;

  return (
    <div>
      {blogPosts.data.map((post) => (
        <BlogPost key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### Development workflow

Once you've scaffolded your Nostalgie project, you're ready to start developing it. The `nostalgie` cli supports a `dev` command to make this easy. It will build your app and run it. Anytime you make changes to your app, it will stop the server, rebuild your app and restart the server. Because we're using [`esbuild`](https://github.com/evanw/esbuild), compilation should be an order of magnitude faster than tools you might be used to using.

```sh
nostalgie dev --port 9090 --env development --root-dir ./example
```

To see other available options:

```sh
nostalgie dev --help
```

### Production workflow

Now that you've built and played with your app locally, it's time to deploy. Nostalgie will eventually support building for many different targets. For the time being, it only supports a node or dockerized node environment.

```sh
nostalgie build --root-dir ./example
```

The above will produce artifacts in the `./example/build` dirctory, suitable for running the application locally via `node ./example/build` or via docker using the `./example/build/Dockerfile`. Nostalgie build artifacts have no further build steps required and do not require any `node_modules` at runtime.

## Vision

Nostalgie removes many of the difficult, contentious decisions from the equation when building for the web. It aims to make it easier than ever to build server-side-rendered (SSR) apps that can be deployed anywhere and that take full advantage of modern facilities like:

- **Async SSR**: Idiomatic code-splitting using `React.lazy` that even works during SSR. You decide where you want to split things up using `React.lazy` and dynamic `import()` expressions and we wire things up so that it _just works_.
- **Routing**: Nested, hierarchical routing using [react-router v5](https://github.com/ReactTraining/react-router), letting you ship those glorious top-level page transitions you desperately wanted but couldn't get in your favourite react SSR framework.
- **SEO**: Full control over the top-level markup rendered by the server using an interface heavily inspired by [react-helmet](https://github.com/nfl/react-helmet). Set your title, meta tags and many others right from within your react components.
- **Styling**: Built-in integration with [tailwind.css](https://tailwindcss.com/) via [`twind`](https://github.com/tw-in-js/twind). Stop worrying about the hard parts of scalable CSS and catch the tropical breeze.
- **Serverless functions**: Expose functions that should run on the back-end directly to the front-end. You define your back-end function and call it directly from the front-end. We wire things up for you transparently. Want the result of these functions to be cacheable? Easy, return a `CacheableValue` from your server function and we'll worry about cacheing. We'll even figure out some smart HTTP cache headers to send automatically based on the cache-ability of all server functions invoked during server rendering so that your CDN can serve from _its cache_.
- **Authentication**: Built-in authentication with any OpenID-compliant service. We think that authentication and identity are a core building block of building any modern web site / app and want to take the complexities off your shoulders.

> _Note: Much of the above is very much an aspirational statement about what we want Nostalgie to be. Not all of this is build (or even designed). That being said, we feel strongly enough about it for it to be mentioned in the vision statement._

## Usage

WIP: See `./example` for a real example.

## FAQ

### Why React?

While we do love alternative libraries (❤️ svelte), _no one ever got fired for choosing React_. This is where the ecosystem and the mind share lives right now. Using anything but React means both: 1) convincing people to use something other than React; and 2) convincing people to try Nostalgie. For now, we decided to focus on the biggest user-base with some ideas to branch out later.
