import { useEffect, useState } from 'react';
import { requestServer } from '../network/packets.ts';
import { createServerUrl } from '../network/serverOptions.ts';
import type { ServerOptions } from '../network/serverOptions.ts';

export type Post = {
  readonly id: number;
  readonly title: string;
  readonly place: string;
  readonly minutesAgo: number;
  readonly price: number;
  readonly photoUrl: string;
  readonly likeCount: number;
  readonly isLiked: boolean;
};

export type PostsStatus = 'loading' | 'ready' | 'failure';

type PostPage = {
  readonly posts: readonly Post[];
  readonly nextCursor: number | null;
};

export function usePosts({ delayMilliseconds, shouldFail }: ServerOptions, pageSize: number) {
  const [posts, setPosts] = useState<readonly Post[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [status, setStatus] = useState<PostsStatus>('loading');

  useEffect(
    function loadNextPage() {
      if (status !== 'loading') {
        return undefined;
      }

      const controller = new AbortController();
      requestPage();

      async function requestPage() {
        try {
          const url = createServerUrl('/api/posts', { delayMilliseconds, shouldFail }, {
            cursor: String(nextCursor),
            limit: String(pageSize),
          });
          const response = await requestServer('게시글', url, { signal: controller.signal });

          if (!response.ok) {
            setStatus('failure');
            return;
          }

          const page: PostPage = await response.json();
          setPosts(function addPage(previousPosts) {
            return [...previousPosts, ...page.posts];
          });
          setNextCursor(page.nextCursor);
          setStatus('ready');
        } catch {
          if (!controller.signal.aborted) {
            setStatus('failure');
          }
        }
      }

      return function cancelPage() {
        controller.abort();
      };
    },
    [status, nextCursor, pageSize, delayMilliseconds, shouldFail],
  );

  function requestNextPage() {
    setStatus('loading');
  }

  return { posts, status, hasNextPage: nextCursor !== null, requestNextPage };
}
