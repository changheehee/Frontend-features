import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export type DrawMode = 'visible' | 'all';

export type DrawnRange = {
  readonly first: number;
  readonly last: number;
};

const EXTRA_ROWS = 4;

export function useVirtualRows(
  scrollBoxRef: RefObject<HTMLDivElement | null>,
  rowCount: number,
  rowHeightPixels: number,
  drawMode: DrawMode,
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const drawnRange = findDrawnRange({ drawMode, rowCount, rowHeightPixels, scrollTop, viewportHeight });

  useEffect(
    function watchViewportHeight() {
      const observer = new ResizeObserver(function updateViewportHeight(entries) {
        setViewportHeight(entries[0]!.contentRect.height);
      });
      observer.observe(scrollBoxRef.current!);

      return function stopWatching() {
        observer.disconnect();
      };
    },
    [scrollBoxRef],
  );

  function followScroll(nextScrollTop: number) {
    if (drawMode === 'visible') {
      setScrollTop(nextScrollTop);
    }
  }

  function syncScrollTop() {
    setScrollTop(scrollBoxRef.current!.scrollTop);
  }

  return { drawnRange, followScroll, syncScrollTop };
}

type DrawnRangeRequest = {
  readonly drawMode: DrawMode;
  readonly rowCount: number;
  readonly rowHeightPixels: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
};

function findDrawnRange({ drawMode, rowCount, rowHeightPixels, scrollTop, viewportHeight }: DrawnRangeRequest): DrawnRange {
  if (drawMode === 'all') {
    return { first: 0, last: rowCount };
  }

  return {
    first: Math.max(0, Math.floor(scrollTop / rowHeightPixels) - EXTRA_ROWS),
    last: Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeightPixels) + EXTRA_ROWS),
  };
}
