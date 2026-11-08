import { useEffect, useRef, useState } from 'react';
import { startStopwatch, waitForNextPaint } from '../measure/measure.ts';
import { useLongestFrameGap } from '../measure/useLongestFrameGap.ts';
import type { DrawMode } from './useVirtualRows.ts';

const SCROLL_PAUSE_MILLISECONDS = 200;

export function useDrawMeasure(drawMode: DrawMode) {
  const [switchMilliseconds, setSwitchMilliseconds] = useState<number | null>(null);
  const [scrollFreezeMilliseconds, setScrollFreezeMilliseconds] = useState<number | null>(null);
  const readSwitchElapsedRef = useRef<(() => number) | null>(null);
  const scrollTimerRef = useRef(0);
  const { resetLongestGap, readLongestGap } = useLongestFrameGap();

  useEffect(
    function measureSwitch() {
      const readSwitchElapsed = readSwitchElapsedRef.current;

      if (readSwitchElapsed === null) {
        return undefined;
      }

      const controller = new AbortController();

      waitForNextPaint().then(function saveSwitchTime() {
        if (controller.signal.aborted) {
          return;
        }

        readSwitchElapsedRef.current = null;
        setSwitchMilliseconds(readSwitchElapsed());
      });

      return function cancelMeasure() {
        controller.abort();
      };
    },
    [drawMode],
  );

  useEffect(function stopScrollTimer() {
    return function clearScrollTimer() {
      clearTimeout(scrollTimerRef.current);
    };
  }, []);

  function startSwitchMeasure() {
    readSwitchElapsedRef.current = startStopwatch();
    setSwitchMilliseconds(null);
    setScrollFreezeMilliseconds(null);
  }

  function recordScroll() {
    if (scrollTimerRef.current === 0) {
      resetLongestGap();
    }

    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(function saveScrollFreeze() {
      scrollTimerRef.current = 0;
      setScrollFreezeMilliseconds(readLongestGap());
    }, SCROLL_PAUSE_MILLISECONDS);
  }

  return { switchMilliseconds, scrollFreezeMilliseconds, startSwitchMeasure, recordScroll };
}
