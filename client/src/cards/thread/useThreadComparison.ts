import { useState } from 'react';
import { startStopwatch, waitForNextPaint } from '../measure/measure.ts';
import { useLongestFrameGap } from '../measure/useLongestFrameGap.ts';
import { logPacket } from '../network/packets.ts';
import { useCloseSignal } from '../network/useCloseSignal.ts';
import { countPrimesBelow } from './countPrimes.ts';

export type RunPlace = 'main' | 'worker';

export type RunResult = {
  readonly primeCount: number;
  readonly elapsedMilliseconds: number;
  readonly longestFreezeMilliseconds: number;
};

export type RunResults = Readonly<Record<RunPlace, RunResult | null>>;

export type ComparePhase = 'idle' | 'warmup' | 'main' | 'rest' | 'worker' | 'done' | 'failed';

const PRIME_LIMIT = 5_000_000;
const WARMUP_MILLISECONDS = 1000;
const REST_BETWEEN_RUNS_MILLISECONDS = 800;
const EMPTY_RESULTS: RunResults = { main: null, worker: null };

export function useThreadComparison() {
  const [phase, setPhase] = useState<ComparePhase>('idle');
  const [results, setResults] = useState<RunResults>(EMPTY_RESULTS);
  const closeSignalRef = useCloseSignal();
  const { resetLongestGap, readLongestGap } = useLongestFrameGap();
  const isComparing = phase !== 'idle' && phase !== 'done' && phase !== 'failed';

  function startComparison() {
    compareInOrder(closeSignalRef.current!).catch(function showFailure(error: unknown) {
      console.error('메인 스레드와 Worker 비교에 실패했습니다.', error);
      setPhase('failed');
    });
  }

  async function compareInOrder(closeSignal: AbortSignal) {
    setResults(EMPTY_RESULTS);

    try {
      setPhase('warmup');
      await wait(WARMUP_MILLISECONDS, closeSignal);

      setPhase('main');
      saveResult('main', await measureOnMainThread(closeSignal));

      setPhase('rest');
      await wait(REST_BETWEEN_RUNS_MILLISECONDS, closeSignal);

      setPhase('worker');
      saveResult('worker', await measureInWorker(closeSignal));
      setPhase('done');
    } catch (error) {
      if (!closeSignal.aborted) {
        throw error;
      }
    }
  }

  async function measureOnMainThread(closeSignal: AbortSignal): Promise<RunResult> {
    await waitForNextPaint();
    resetLongestGap();
    const readElapsedMilliseconds = startStopwatch();
    const primeCount = countPrimesBelow(PRIME_LIMIT);
    const elapsedMilliseconds = readElapsedMilliseconds();
    await waitForNextPaint();
    closeSignal.throwIfAborted();

    return { primeCount, elapsedMilliseconds, longestFreezeMilliseconds: readLongestGap() };
  }

  async function measureInWorker(closeSignal: AbortSignal): Promise<RunResult> {
    resetLongestGap();
    const readElapsedMilliseconds = startStopwatch();
    const primeCount = await countPrimesInWorker(PRIME_LIMIT, closeSignal);

    return {
      primeCount,
      elapsedMilliseconds: readElapsedMilliseconds(),
      longestFreezeMilliseconds: readLongestGap(),
    };
  }

  function saveResult(place: RunPlace, result: RunResult) {
    setResults(function addResult(previousResults) {
      return { ...previousResults, [place]: result };
    });
  }

  return { phase, results, isComparing, startComparison };
}

function wait(milliseconds: number, closeSignal: AbortSignal): Promise<void> {
  return new Promise(function waitForTimer(resolve, reject) {
    closeSignal.throwIfAborted();
    const timerId = setTimeout(finishWaiting, milliseconds);
    closeSignal.addEventListener('abort', cancelWaiting, { once: true });

    function finishWaiting() {
      closeSignal.removeEventListener('abort', cancelWaiting);
      resolve();
    }

    function cancelWaiting() {
      clearTimeout(timerId);
      reject(closeSignal.reason);
    }
  });
}

function countPrimesInWorker(limit: number, closeSignal: AbortSignal): Promise<number> {
  return new Promise(function waitForWorker(resolve, reject) {
    closeSignal.throwIfAborted();
    const worker = new Worker(new URL('./primeWorker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', receivePrimeCount);
    worker.addEventListener('error', failWorker);
    closeSignal.addEventListener('abort', cancelWorker, { once: true });
    worker.postMessage(limit);
    logPacket('Worker', 'request', 'postMessage', limit);

    function receivePrimeCount(event: MessageEvent<number>) {
      logPacket('Worker', 'response', 'postMessage', event.data);
      stopWorker();
      resolve(event.data);
    }

    function failWorker(event: ErrorEvent) {
      stopWorker();
      reject(new Error(`Worker에서 소수를 세지 못했습니다: ${event.message}`));
    }

    function cancelWorker() {
      worker.terminate();
      reject(closeSignal.reason);
    }

    function stopWorker() {
      closeSignal.removeEventListener('abort', cancelWorker);
      worker.terminate();
    }
  });
}
