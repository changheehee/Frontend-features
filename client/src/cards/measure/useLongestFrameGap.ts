import { useEffect, useRef } from 'react';

export function useLongestFrameGap() {
  const longestGapRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const frameIdRef = useRef(0);

  useEffect(function watchFrames() {
    lastFrameTimeRef.current = performance.now();
    frameIdRef.current = requestAnimationFrame(recordFrame);

    function recordFrame() {
      const now = performance.now();
      longestGapRef.current = Math.max(longestGapRef.current, now - lastFrameTimeRef.current);
      lastFrameTimeRef.current = now;
      frameIdRef.current = requestAnimationFrame(recordFrame);
    }

    return function stopWatchingFrames() {
      cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  function resetLongestGap() {
    longestGapRef.current = 0;
  }

  function readLongestGap() {
    return longestGapRef.current;
  }

  return { resetLongestGap, readLongestGap };
}
