import { useEffect, useState } from 'react';
import { requestServer } from '../network/packets.ts';
import { createServerUrl } from '../network/serverOptions.ts';

export type Product = {
  readonly id: string;
  readonly name: string;
};

export type SearchResult = {
  readonly keyword: string;
  readonly products: readonly Product[];
  readonly suggestion: string | null;
};

export type SearchStatus = 'loading' | 'success' | 'failure';

type SearchRequest = {
  readonly keyword: string;
  readonly delayMilliseconds: number;
  readonly shouldFail: boolean;
};

type SearchResponse = {
  readonly products: readonly Product[];
  readonly suggestion: string | null;
};

const REQUEST_PAUSE_MILLISECONDS = 300;

export function useProductSearch({ keyword, delayMilliseconds, shouldFail }: SearchRequest) {
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [result, setResult] = useState<SearchResult>({ keyword: '', products: [], suggestion: null });

  useEffect(
    function searchAfterPause() {
      const controller = new AbortController();
      const timerId = setTimeout(requestProducts, REQUEST_PAUSE_MILLISECONDS);

      async function requestProducts() {
        setStatus('loading');

        try {
          const url = createServerUrl('/api/search', { delayMilliseconds, shouldFail }, { keyword });
          const response = await requestServer('검색', url, { signal: controller.signal });

          if (!response.ok) {
            setStatus('failure');
            return;
          }

          const searchResponse: SearchResponse = await response.json();
          setResult({ keyword, products: searchResponse.products, suggestion: searchResponse.suggestion });
          setStatus('success');
        } catch {
          if (!controller.signal.aborted) {
            setStatus('failure');
          }
        }
      }

      return function cancelSearch() {
        clearTimeout(timerId);
        controller.abort();
      };
    },
    [keyword, delayMilliseconds, shouldFail, retryTrigger],
  );

  function retrySearch() {
    setStatus('loading');
    setRetryTrigger(retryTrigger + 1);
  }

  return { status, result, retrySearch };
}
