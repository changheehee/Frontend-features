import { useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { ControlPanel } from '../controls/ControlPanel.tsx';
import { formatSeconds } from '../measure/measure.ts';
import { SegmentedChoice } from '../controls/SegmentedChoice.tsx';
import { ServerControls } from '../controls/ServerControls.tsx';
import { describeServerOptions } from '../network/serverOptions.ts';
import './postCard.css';
import { PostListEnd } from './PostListEnd.tsx';
import { PostRow } from './PostRow.tsx';
import { useDrawMeasure } from './useDrawMeasure.ts';
import { useLoadNearBottom } from './useLoadNearBottom.ts';
import { usePostLikes } from './usePostLikes.ts';
import { usePosts } from './usePosts.ts';
import type { Post } from './usePosts.ts';
import { useTimedNotice } from './useTimedNotice.ts';
import { useVirtualRows } from './useVirtualRows.ts';
import type { DrawMode, DrawnRange } from './useVirtualRows.ts';

const ROW_HEIGHT_PIXELS = 128;
const NOTICE_SHOWN_MILLISECONDS = 3000;
const UNKNOWN_SET_SIZE = -1;
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10개' },
  { value: 1000, label: '1,000개' },
];
const DRAW_MODE_OPTIONS: readonly { value: DrawMode; label: string }[] = [
  { value: 'visible', label: '보이는 것만' },
  { value: 'all', label: '전부' },
];

export function PostCard() {
  const [delayMilliseconds, setDelayMilliseconds] = useState(1000);
  const [shouldFail, setShouldFail] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [drawMode, setDrawMode] = useState<DrawMode>('visible');
  const serverOptions = { delayMilliseconds, shouldFail };
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { noticeText, showNotice } = useTimedNotice(NOTICE_SHOWN_MILLISECONDS);
  const { posts, status, hasNextPage, requestNextPage } = usePosts(serverOptions, pageSize);
  const { showLike, isSaving, toggleLike } = usePostLikes(serverOptions, showSaveFailure);
  const virtualRows = useVirtualRows(scrollBoxRef, posts.length, ROW_HEIGHT_PIXELS, drawMode);
  const drawMeasure = useDrawMeasure(drawMode);
  const { drawnRange } = virtualRows;

  useLoadNearBottom(scrollBoxRef, bottomRef, status === 'ready' && hasNextPage, requestNextPage);

  function showSaveFailure(post: Post) {
    showNotice(`'${post.title}' 관심 저장에 실패해 되돌렸습니다.`);
  }

  function changeDrawMode(nextMode: DrawMode) {
    drawMeasure.startSwitchMeasure();
    virtualRows.syncScrollTop();
    setDrawMode(nextMode);
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    virtualRows.followScroll(event.currentTarget.scrollTop);
    drawMeasure.recordScroll();
  }

  return (
    <div className="post-card">
      <ControlPanel summary={describeControls(delayMilliseconds, shouldFail, pageSize, drawMode)}>
        <ServerControls
          delayMilliseconds={delayMilliseconds}
          shouldFail={shouldFail}
          changeDelay={setDelayMilliseconds}
          changeShouldFail={setShouldFail}
        />
        <SegmentedChoice title="한 번에 받기" options={PAGE_SIZE_OPTIONS} value={pageSize} changeValue={setPageSize} />
        <SegmentedChoice title="그리기" options={DRAW_MODE_OPTIONS} value={drawMode} changeValue={changeDrawMode} />
      </ControlPanel>

      <div className="post-card-frame">
        <div ref={scrollBoxRef} className="post-card-scroll" onScroll={handleScroll}>
          <ul className="post-card-list" style={{ blockSize: posts.length * ROW_HEIGHT_PIXELS }}>
            {posts.slice(drawnRange.first, drawnRange.last).map(function renderPost(post, offset) {
              const index = drawnRange.first + offset;

              return (
                <PostRow
                  key={post.id}
                  post={post}
                  position={index + 1}
                  setSize={hasNextPage ? UNKNOWN_SET_SIZE : posts.length}
                  offsetPixels={index * ROW_HEIGHT_PIXELS}
                  like={showLike(post)}
                  isSaving={isSaving(post.id)}
                  toggleLike={toggleLike}
                />
              );
            })}
          </ul>
          <div ref={bottomRef} className="post-card-bottom">
            <PostListEnd status={status} hasNextPage={hasNextPage} postCount={posts.length} retry={requestNextPage} />
          </div>
        </div>
        <p className="post-card-stats">
          {describeStats(posts.length, drawnRange, drawMeasure.switchMilliseconds, drawMeasure.scrollFreezeMilliseconds)}
        </p>
        <output className="post-card-notice" data-visible={noticeText !== null} aria-atomic="true">
          {noticeText}
        </output>
      </div>
    </div>
  );
}

function describeControls(delayMilliseconds: number, shouldFail: boolean, pageSize: number, drawMode: DrawMode): string {
  const drawText = drawMode === 'visible' ? '보이는 것만 그리기' : '전부 그리기';

  return `${describeServerOptions(delayMilliseconds, shouldFail)} · ${pageSize.toLocaleString('ko-KR')}개씩 받기 · ${drawText}`;
}

function describeStats(
  postCount: number,
  drawnRange: DrawnRange,
  switchMilliseconds: number | null,
  scrollFreezeMilliseconds: number | null,
): string {
  const drawnCount = drawnRange.last - drawnRange.first;
  const countText = `불러온 글 ${postCount.toLocaleString('ko-KR')}개 · 화면에 만든 행 ${drawnCount.toLocaleString('ko-KR')}개`;
  const switchText = switchMilliseconds === null ? '' : ` · 바꾸는 데 ${formatSeconds(switchMilliseconds)}`;
  const scrollText =
    scrollFreezeMilliseconds === null ? '' : ` · 스크롤 중 최대 멈춤 ${formatSeconds(scrollFreezeMilliseconds)}`;

  return countText + switchText + scrollText;
}
