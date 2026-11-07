import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import './searchCard.css';
import { useProductSearch } from './useProductSearch.ts';
import type { Product, SearchResult, SearchStatus } from './useProductSearch.ts';

const DELAY_OPTIONS = [
  { label: '없음', milliseconds: 0 },
  { label: '1초', milliseconds: 1000 },
  { label: '3초', milliseconds: 3000 },
] as const;

export function SearchCard() {
  const [searchText, setSearchText] = useState('');
  const [delayMilliseconds, setDelayMilliseconds] = useState(0);
  const [shouldFail, setShouldFail] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyword = searchText.trim();
  const { status, result, retrySearch } = useProductSearch({
    keyword,
    delayMilliseconds,
    shouldFail,
  });

  function updateSearchText(event: ChangeEvent<HTMLInputElement>) {
    setSearchText(event.currentTarget.value);
  }

  function updateDelay(event: ChangeEvent<HTMLSelectElement>) {
    setDelayMilliseconds(Number(event.currentTarget.value));
  }

  function updateShouldFail(event: ChangeEvent<HTMLInputElement>) {
    setShouldFail(event.currentTarget.checked);
  }

  function retryFromSearchInput() {
    searchInputRef.current!.focus();
    retrySearch();
  }

  return (
    <div className="search-card">
      <fieldset className="search-card-server">
        <legend className="search-card-label-text">서버 조절</legend>
        <label className="search-card-server-option">
          응답 지연
          <select value={delayMilliseconds} onChange={updateDelay}>
            {DELAY_OPTIONS.map(function renderDelayOption(option) {
              return (
                <option key={option.milliseconds} value={option.milliseconds}>
                  {option.label}
                </option>
              );
            })}
          </select>
        </label>
        <label className="search-card-server-option">
          <input type="checkbox" checked={shouldFail} onChange={updateShouldFail} />
          요청 실패시키기
        </label>
      </fieldset>

      <label className="search-card-label">
        <span className="search-card-label-text">상품 검색</span>
        <input
          ref={searchInputRef}
          className="search-card-input"
          type="search"
          value={searchText}
          onChange={updateSearchText}
        />
      </label>

      <output className="search-card-status" aria-atomic="true">
        {describeStatus(status, result)}
      </output>

      <SearchOutcome status={status} products={result.products} retrySearch={retryFromSearchInput} />
    </div>
  );
}

function describeStatus(status: SearchStatus, result: SearchResult): string {
  switch (status) {
    case 'loading':
      return '검색 중…';
    case 'failure':
      return '서버 응답을 받지 못했습니다.';
    case 'success':
      return describeProducts(result);
  }
}

function describeProducts(result: SearchResult): string {
  if (result.products.length === 0) {
    return `'${result.keyword}'에 맞는 상품이 없습니다.`;
  }

  return `상품 ${result.products.length}개`;
}

type SearchOutcomeProps = {
  readonly status: SearchStatus;
  readonly products: readonly Product[];
  readonly retrySearch: () => void;
};

function SearchOutcome({ status, products, retrySearch }: SearchOutcomeProps) {
  if (status === 'failure') {
    return (
      <button className="search-card-retry" type="button" onClick={retrySearch}>
        다시 시도
      </button>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <ul className="search-card-results">
      {products.map(function renderProduct(product) {
        return (
          <li className="search-card-product" key={product.id}>
            {product.name}
          </li>
        );
      })}
    </ul>
  );
}
