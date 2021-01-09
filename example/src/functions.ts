import got from 'got';
// import * as Http from 'http';
// import * as Https from 'https';
import type { ServerFunctionContext } from 'nostalgie';
// import QuickLRU from 'quick-lru';

// const cache = new QuickLRU({ maxSize: 256 });
// const httpAgent = new Http.Agent({ keepAlive: true });
// const httpsAgent = new Https.Agent({ keepAlive: true });
const cachedGot = got.extend({
  // agent: { http: httpAgent, https: httpsAgent },
  // cache,
});

export async function getStoriesList(_ctx: ServerFunctionContext, listKey: 'topstories') {
  const res = await cachedGot(`https://hacker-news.firebaseio.com/v0/${listKey}.json`, {
    responseType: 'json',
  });

  return (res.body as number[]).slice(0, 20);
}

export async function getStory(_ctx: ServerFunctionContext, storyId: number) {
  const res = await cachedGot(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`, {
    responseType: 'json',
  });

  return res.body;
}
