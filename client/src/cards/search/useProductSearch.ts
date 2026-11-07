import { useEffect, useState } from 'react';

export type Product = {
  readonly id: string;
  readonly name: string;
};

export type SearchResult = {
  readonly keyword: string;
  readonly products: readonly Product[];
};

export type SearchStatus = 'loading' | 'success' | 'failure';

type SearchRequest = {
  readonly keyword: string;
  readonly delayMilliseconds: number;
  readonly shouldFail: boolean;
};

type SearchResponse = {
  readonly products: readonly Product[];
};

const REQUEST_PAUSE_MILLISECONDS = 300;

export function useProductSearch({ keyword, delayMilliseconds, shouldFail }: SearchRequest) {
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [result, setResult] = useState<SearchResult>({ keyword: '', products: [] });

  useEffect(
    function searchAfterPause() {
      const controller = new AbortController();
      const timerId = setTimeout(requestProducts, REQUEST_PAUSE_MILLISECONDS);

      async function requestProducts() {
        setStatus('loading');

        try {
          const url = createSearchUrl({ keyword, delayMilliseconds, shouldFail });
          const response = await fetch(url, { signal: controller.signal });

          if (!response.ok) {
            setStatus('failure');
            return;
          }

          const searchResponse: SearchResponse = await response.json();
          setResult({ keyword, products: searchResponse.products });
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

function createSearchUrl({ keyword, delayMilliseconds, shouldFail }: SearchRequest): string {
  const query = new URLSearchParams({
    keyword,
    delayMilliseconds: String(delayMilliseconds),
    fail: String(shouldFail),
  });

  return `/api/search?${query}`;
}
