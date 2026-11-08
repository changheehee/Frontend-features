import { countPrimesBelow } from './countPrimes.ts';

addEventListener('message', function countPrimesInWorker(event: MessageEvent<number>) {
  postMessage(countPrimesBelow(event.data));
});
