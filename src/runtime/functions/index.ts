export * from 'react-query';

import { createFunctionMutationBrowser, createFunctionQueryBrowser } from './browser';
import { createFunctionMutationServer, createFunctionQueryServer } from './server';
import type {
  FunctionMutationOptions,
  FunctionQueryOptions,
  FunctionReturnType,
  NonContextFunctionArgs,
  ServerFunction,
} from './types';

/**
 * Create a `react-query` `useQuery` hook function suitable for reading data from a
 * Nostalgie Function
 *
 * @param fn A reference to a Nostalgie Function exposed via the Functions Entrypoint
 * @param factoryOptions Default options to apply to all invocations of the actual
 * query. You might use this to set default cache values like `stateTime`.
 *
 * @example
 * ```ts
 * import * as React from 'react';
 * import { createFunctionQuery } from 'nostalgie/functions';
 * import { listBlogPosts } from './functions.ts';
 *
 * const useBlogPosts = createFunctionQuery(listBlogPosts, { staleTime: 30000 });
 *
 * export default function BlogPosts() {
 *   const posts = useBlogPosts([]);
 *
 *   if (posts.isLoading) return <div>Loading...</div>;
 *   if (posts.isError) return <div>{`Error: ${data.error}`</div>
 *
 *   return posts.data.map(post => (
 *     <BlogPost key={post.id} post={post} />
 *   ));
 * }
 * ```
 */
export function createFunctionQuery<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionQueryOptions = {}
) {
  if (!isFunctionFacade(fn)) {
    throw new Error(
      'Invariant violation: Attempting to invoke a server function not decorated by the Proxy facade'
    );
  }

  if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
    return createFunctionQueryBrowser(fn, factoryOptions);
  }

  return createFunctionQueryServer(fn, factoryOptions);
}

/**
 *
 * @param fn A reference to a Nostalgie Function exposed via the Functions Entrypoint
 * @param factoryOptions Default options to apply to all invocations of the actual
 * mutation. You might use this to set default observer hooks like `onError`.
 *
 * @example
 * ```ts
 * import * as React from 'react';
 * import { createFunctionQuery } from 'nostalgie/functions';
 * import { likeBlogPost } from './functions.ts';
 * import type { BlogPost } from './functions.ts';
 *
 * const useLikePost = createFunctionMutation(likeBlogPost);
 *
 * export default function BlogPost(props: React.PropsWithChildren<{ post: BlogPost }>) {
 *   const likePost = useLikePost();
 *   const onClickLike = (e: React.MouseEvent) => {
 *     e.preventDefault();
 *     likePost.mutate([post.id]);
 *   }
 *
 *   return (
 *     <div>
 *       <h3>{post.title}</h3>
 *       <p>{post.body}</p>
 *       <div className="actions">
 *         <button onClick={onClickLike}>Like</button>
 *         {likePost.isLoading ? '...' : null}
 *         {likePost.isError ? likePost.error.message : null}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function createFunctionMutation<T extends ServerFunction>(
  fn: T,
  factoryOptions: FunctionMutationOptions<
    FunctionReturnType<T>,
    unknown,
    NonContextFunctionArgs<T>
  > = {}
) {
  if (!isFunctionFacade(fn)) {
    throw new Error(
      'Invariant violation: Attempting to invoke a server function not decorated by the Proxy facade'
    );
  }

  if (process.env.NOSTALGIE_BUILD_TARGET === 'browser') {
    return createFunctionMutationBrowser(fn, factoryOptions);
  }

  return createFunctionMutationServer(fn, factoryOptions);
}

interface FunctionFacade {
  name: string;
}

function isFunctionFacade(fn: unknown): fn is FunctionFacade {
  return fn && typeof fn === 'object' && (fn as any).name && typeof (fn as any).name === 'string';
}
