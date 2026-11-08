export function startStopwatch() {
  const startTime = performance.now();

  return function readElapsedMilliseconds() {
    return performance.now() - startTime;
  };
}

export function waitForNextPaint(): Promise<void> {
  return new Promise(function waitTwoFrames(resolve) {
    requestAnimationFrame(function afterFirstFrame() {
      requestAnimationFrame(function afterSecondFrame() {
        resolve();
      });
    });
  });
}

export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(2)}초`;
}
