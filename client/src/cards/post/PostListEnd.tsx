import type { PostsStatus } from './usePosts.ts';

type PostListEndProps = {
  readonly status: PostsStatus;
  readonly hasNextPage: boolean;
  readonly postCount: number;
  readonly retry: () => void;
};

export function PostListEnd({ status, hasNextPage, postCount, retry }: PostListEndProps) {
  return (
    <>
      {status === 'loading' && (
        <div className="post-card-skeletons" aria-hidden="true">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}
      <output className="post-card-progress" aria-atomic="true">
        {describeProgress(status, postCount, hasNextPage)}
      </output>
      {status === 'failure' && (
        <button className="post-card-retry" type="button" onClick={retry}>
          다시 시도
        </button>
      )}
    </>
  );
}

function PostSkeleton() {
  return (
    <div className="post-card-skeleton">
      <div className="post-card-skeleton-photo" />
      <div className="post-card-skeleton-lines">
        <div className="post-card-skeleton-line" />
        <div className="post-card-skeleton-line" />
        <div className="post-card-skeleton-line" />
      </div>
    </div>
  );
}

function describeProgress(status: PostsStatus, postCount: number, hasNextPage: boolean): string {
  const countText = postCount.toLocaleString('ko-KR');

  switch (status) {
    case 'loading':
      return postCount === 0 ? '게시글을 불러오는 중…' : '다음 글을 불러오는 중…';
    case 'failure':
      return '글을 불러오지 못했습니다.';
    case 'ready':
      return hasNextPage ? `불러온 글 ${countText}개` : `마지막 글입니다 · 모두 ${countText}개`;
  }
}
