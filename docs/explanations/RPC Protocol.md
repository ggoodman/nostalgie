---
title: "The RPC Protocol"
category: "explanations"
---

# The RPC Protocol

Nostalgie's 'magic' Server Functions rely on the colocation and tight-coupling of the front-end code and it's accompanying backend-for-the-frontend. These two components are provided by the Application Entrypoint and the Functions Entrypoint, respectively. Nostalgie assumes that the sorts of apps built upon it will be constantly invoking Server Functions. In that light, we need to consider some of the constraints of the browser environment in order to deliver the best possible experience.

## Browser constraints

We know that the cost of a single http round-trip is non-negligible, especially on slower internet connections or those with high latency. We also know, anecdotally, that Chrome imposes a maximum of 6 concurrent connections to the same target host. Nostalgie's RPC protocol is designed to partially address these challenges.

## The RPC invocation design

Nostalgie, like any React app, operates on the basis of 'renders'. During the rendering of the app, it is possible that many new Server Function calls are issued. When we receive the first such invocation, we queue it up until a point very soon in the future. This act of queueing gives us time to collect any other invocations that may have happened in the same, or subsequent render cycles.

Once such a 'batch' of requests has been collected, we fire off a `POST` request to the `/.nostalgie/rpc` endpoint with a representation of those function calls in the payload. Nostalgie's `/.nostalgie/rpc` handler is able to parse this series of calls and coordinate the responses in a low-latency and efficient manner.

You may be thinking that if these batches are fired off as a unit then NO function call has a chance of resolving until the slowest call completes. This would be true if we waited for the full resonse body to start settling function invocation Promises. Instead, we use the streaming response capabilities of `fetch` to receive chunks of the response as quickly as possible and we are able to read these (even out-of-order). In this way, Server Function calls are able to settle quickly while minimixing http round-trips.