import { useEffect, useRef } from 'react';

export function useCloseSignal() {
  const closeSignalRef = useRef<AbortSignal | null>(null);

  useEffect(function watchForClose() {
    const closeController = new AbortController();
    closeSignalRef.current = closeController.signal;

    return function signalClosed() {
      closeController.abort();
    };
  }, []);

  return closeSignalRef;
}
