import type { Like } from './usePostLikes.ts';
import type { Post } from './usePosts.ts';

type PostRowProps = {
  readonly post: Post;
  readonly position: number;
  readonly setSize: number;
  readonly offsetPixels: number;
  readonly like: Like;
  readonly isSaving: boolean;
  readonly toggleLike: (post: Post) => void;
};

const HEART_PATH =
  'M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.8 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.3 0 5.5 3.2 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z';
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;

export function PostRow({ post, position, setSize, offsetPixels, like, isSaving, toggleLike }: PostRowProps) {
  function toggleThisPost() {
    toggleLike(post);
  }

  return (
    <li
      className="post-card-item"
      style={{ insetBlockStart: offsetPixels }}
      aria-posinset={position}
      aria-setsize={setSize}
    >
      <img className="post-card-photo" src={post.photoUrl} alt="" width={400} height={400} loading="lazy" />
      <div className="post-card-text">
        <h3 className="post-card-title">{post.title}</h3>
        <p className="post-card-meta">
          {post.place} · {describeTimeAgo(post.minutesAgo)}
        </p>
        <p className="post-card-price">{describePrice(post.price)}</p>
      </div>
      <button
        className="post-card-like"
        type="button"
        aria-pressed={like.isLiked}
        aria-label={`${post.title} 관심 ${like.likeCount}`}
        data-saving={isSaving}
        onClick={toggleThisPost}
      >
        <svg className="post-card-heart" viewBox="0 0 24 24" aria-hidden="true">
          <path d={HEART_PATH} />
        </svg>
        {like.likeCount}
      </button>
    </li>
  );
}

function describePrice(price: number): string {
  if (price === 0) {
    return '나눔';
  }

  return `${price.toLocaleString('ko-KR')}원`;
}

function describeTimeAgo(minutesAgo: number): string {
  if (minutesAgo < MINUTES_PER_HOUR) {
    return `${minutesAgo}분 전`;
  }

  if (minutesAgo < MINUTES_PER_DAY) {
    return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)}시간 전`;
  }

  return `${Math.floor(minutesAgo / MINUTES_PER_DAY)}일 전`;
}
