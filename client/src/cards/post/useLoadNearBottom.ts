import { useEffect } from 'react';
import type { RefObject } from 'react';

const LOAD_BEFORE_BOTTOM_PIXELS = 200;

export function useLoadNearBottom(
  scrollBoxRef: RefObject<HTMLDivElement | null>,
  bottomRef: RefObject<HTMLDivElement | null>,
  canLoadMore: boolean,
  loadMore: () => void,
) {
  useEffect(
    function loadWhenBottomIsNear() {
      if (!canLoadMore) {
        return undefined;
      }

      const observer = new IntersectionObserver(checkBottom, {
        root: scrollBoxRef.current,
        rootMargin: `0px 0px ${LOAD_BEFORE_BOTTOM_PIXELS}px 0px`,
      });
      observer.observe(bottomRef.current!);

      function checkBottom(entries: IntersectionObserverEntry[]) {
        if (entries[0]!.isIntersecting) {
          loadMore();
        }
      }

      return function stopWatching() {
        observer.disconnect();
      };
    },
    [scrollBoxRef, bottomRef, canLoadMore, loadMore],
  );
}
