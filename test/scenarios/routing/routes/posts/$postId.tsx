import { useParams } from 'nostalgie/routing';

export default function PostId() {
  const params = useParams();

  return (
    <article>
      <h1>{`Post ${params.postId}`}</h1>
    </article>
  );
}
