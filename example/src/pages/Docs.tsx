import { Head, useFunction } from 'nostalgie';
import * as React from 'react';
import { getStoriesList, getStory } from '../functions';

export default function DocsPage() {
  const stories = useFunction(getStoriesList, ['topstories'], {
    cacheTime: 20000,
  });

  return (
    <>
      <Head.Title>Nostalgie - Docs</Head.Title>

      {stories.status === 'success' ? (
        (stories.data as number[]).slice(0, 20).map((storyId) => (
          <React.Suspense key={storyId} fallback={<h1>Loading...</h1>}>
            <Story storyId={storyId} key={storyId} />
          </React.Suspense>
        ))
      ) : (
        <div>Loading...</div>
      )}
    </>
  );
}

function Story(props: { storyId: number }) {
  const story = useFunction(getStory, [props.storyId], { cacheTime: 20000, suspense: true });

  return story.isFetched ? <h1>{(story.data as any).title}</h1> : <h1>Loading...</h1>;
}
