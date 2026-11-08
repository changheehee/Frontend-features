import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

const BOTTOM_SLACK_PIXELS = 48;

export function useStickToLatest(
  listRef: RefObject<HTMLDivElement | null>,
  latestKey: string | null,
  isLatestFromPartner: boolean,
) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const hasUnseenMessage = !isAtBottom && isLatestFromPartner && latestKey !== seenKey;

  useLayoutEffect(
    function stickToBottom() {
      if (isAtBottom) {
        const list = listRef.current!;
        list.scrollTop = list.scrollHeight;
      }
    },
    [listRef, latestKey, isAtBottom],
  );

  function followScroll(list: HTMLDivElement) {
    const isNowAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < BOTTOM_SLACK_PIXELS;

    if (isNowAtBottom || isAtBottom) {
      setSeenKey(latestKey);
    }

    setIsAtBottom(isNowAtBottom);
  }

  function jumpToLatest() {
    setIsAtBottom(true);
  }

  return { hasUnseenMessage, followScroll, jumpToLatest };
}
