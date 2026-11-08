import type { DataFlow } from '../frame/FlowDiagram.tsx';

export const THREAD_FLOW: DataFlow = {
  lanes: [
    { name: '메인 스레드', detail: '화면을 그리는 스레드' },
    { name: 'Worker', detail: 'primeWorker.ts' },
  ],
  steps: [
    { type: 'note', side: 'left', text: '1/2 직접 countPrimesBelow(5,000,000) · 그동안 화면이 멈춥니다' },
    {
      type: 'message',
      from: 'left',
      label: 'postMessage(5000000)',
      detail: '2/2 같은 계산을 Worker에게 맡깁니다',
    },
    { type: 'note', side: 'right', text: 'Worker 스레드에서 계산합니다' },
    {
      type: 'message',
      from: 'right',
      label: 'postMessage(348513)',
      detail: '찾은 소수 개수를 돌려받습니다 · 그동안 화면은 계속 움직입니다',
    },
    { type: 'note', side: 'left', text: 'worker.terminate() · 패널을 닫아도 정리합니다' },
  ],
  caption: '이 카드는 서버와 통신하지 않습니다. 데이터는 메인 스레드와 Worker 사이에서만 오갑니다.',
};
