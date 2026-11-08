import { useRef } from 'react';
import { formatSeconds } from '../measure/measure.ts';
import './threadCard.css';
import { useCatStage } from './useCatStage.ts';
import { useThreadComparison } from './useThreadComparison.ts';
import type { ComparePhase, RunResult } from './useThreadComparison.ts';

type ResultText = {
  readonly primeCount: string;
  readonly elapsed: string;
  readonly longestFreeze: string;
};

export function ThreadCard() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<HTMLProgressElement>(null);
  const { phase, results, isComparing, startComparison } = useThreadComparison();

  useCatStage(canvasHostRef, playbackRef);

  return (
    <div className="thread-card">
      <div className="thread-card-stage">
        <div ref={canvasHostRef} className="thread-card-canvas" aria-hidden="true" />
        <progress ref={playbackRef} className="thread-card-playback" max={1} aria-label="고양이 애니메이션 재생 위치" />
      </div>

      <button className="thread-card-compare" type="button" disabled={isComparing} onClick={startComparison}>
        {describeCompareButton(phase)}
      </button>

      <div className="thread-card-results">
        <RunTile name="메인 스레드" isRunning={phase === 'main'} result={results.main} />
        <RunTile name="Worker" isRunning={phase === 'worker'} result={results.worker} />
      </div>
    </div>
  );
}

type RunTileProps = {
  readonly name: string;
  readonly isRunning: boolean;
  readonly result: RunResult | null;
};

function RunTile({ name, isRunning, result }: RunTileProps) {
  const text = describeResult(result);

  return (
    <div className="thread-card-tile" data-running={isRunning} aria-live="polite" aria-atomic="true">
      <div className="thread-card-tile-head">
        <h3 className="thread-card-tile-name">{name}</h3>
        {isRunning && <span className="thread-card-tile-badge">계산 중</span>}
      </div>
      <dl className="thread-card-tile-stats">
        <div className="thread-card-tile-freeze">
          <dt>화면이 멈춘 최대 시간</dt>
          <dd>{text.longestFreeze}</dd>
        </div>
        <div className="thread-card-tile-detail">
          <dt>걸린 시간</dt>
          <dd>{text.elapsed}</dd>
        </div>
        <div className="thread-card-tile-detail">
          <dt>찾은 소수</dt>
          <dd>{text.primeCount}</dd>
        </div>
      </dl>
    </div>
  );
}

function describeResult(result: RunResult | null): ResultText {
  if (result === null) {
    return { primeCount: '-', elapsed: '-', longestFreeze: '-' };
  }

  return {
    primeCount: `${result.primeCount.toLocaleString('ko-KR')}개`,
    elapsed: formatSeconds(result.elapsedMilliseconds),
    longestFreeze: formatSeconds(result.longestFreezeMilliseconds),
  };
}

function describeCompareButton(phase: ComparePhase): string {
  switch (phase) {
    case 'idle':
      return '차례로 비교하기';
    case 'warmup':
      return '곧 시작합니다…';
    case 'main':
      return '1/2 메인 스레드 계산 중…';
    case 'rest':
      return '곧 Worker로 계산합니다…';
    case 'worker':
      return '2/2 Worker 계산 중…';
    case 'done':
      return '다시 비교하기';
    case 'failed':
      return '실패 · 다시 비교하기';
  }
}
