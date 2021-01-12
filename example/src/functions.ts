import got from 'got';
import type { ServerFunctionContext } from 'nostalgie';
const cachedGot = got.extend({});

export async function getHackerNewsStories(ctx: ServerFunctionContext, listKey: 'front_page') {
  const result = await getWithGot<{ hits: { objectID: string; title: string }[] }>(
    ctx,
    `https://hn.algolia.com/api/v1/search?tags=${encodeURIComponent(listKey)}`
  );

  return result.hits;
}

export async function getStory(ctx: ServerFunctionContext, storyId: number) {
  const result = await getWithGot(
    ctx,
    `http://hn.algolia.com/api/v1/items/${encodeURIComponent(storyId)}`
  );

  return result;
}

async function getWithGot<T = unknown>(ctx: ServerFunctionContext, url: string): Promise<T> {
  const req = cachedGot(url, {
    responseType: 'json',
  });

  if (ctx.signal) {
    ctx.signal.onabort = () => req.cancel();
  }

  const res = await req;

  return res.body as T;
}
