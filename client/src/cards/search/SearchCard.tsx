import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ControlPanel } from '../controls/ControlPanel.tsx';
import { ServerControls } from '../controls/ServerControls.tsx';
import { describeServerOptions } from '../network/serverOptions.ts';
import './searchCard.css';
import { useProductSearch } from './useProductSearch.ts';
import type { Product, SearchResult, SearchStatus } from './useProductSearch.ts';

const FIRST_SYLLABLE_CODE = 0xac00;
const LAST_SYLLABLE_CODE = 0xd7a3;
const FINALS_PER_MEDIAL = 28;

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

  function retryFromSearchInput() {
    searchInputRef.current!.focus();
    retrySearch();
  }

  function searchSuggestion(suggestion: string) {
    setSearchText(suggestion);
    searchInputRef.current!.focus();
  }

  return (
    <div className="search-card">
      <ControlPanel summary={describeServerOptions(delayMilliseconds, shouldFail)}>
        <ServerControls
          delayMilliseconds={delayMilliseconds}
          shouldFail={shouldFail}
          changeDelay={setDelayMilliseconds}
          changeShouldFail={setShouldFail}
        />
      </ControlPanel>

      <label className="search-card-label">
        <span className="search-card-label-text">상품 검색</span>
        <input
          ref={searchInputRef}
          className="search-card-input"
          type="search"
          placeholder="예: 바나나"
          value={searchText}
          onChange={updateSearchText}
        />
      </label>

      <output className="search-card-status" aria-atomic="true">
        {describeStatus(status, result)}
      </output>

      <SearchOutcome
        status={status}
        result={result}
        retrySearch={retryFromSearchInput}
        searchSuggestion={searchSuggestion}
      />
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
  readonly result: SearchResult;
  readonly retrySearch: () => void;
  readonly searchSuggestion: (suggestion: string) => void;
};

function SearchOutcome({ status, result, retrySearch, searchSuggestion }: SearchOutcomeProps) {
  if (status === 'failure') {
    return (
      <button className="search-card-retry" type="button" onClick={retrySearch}>
        다시 시도
      </button>
    );
  }

  if (result.products.length === 0) {
    return result.suggestion === null ? null : (
      <SuggestionButton suggestion={result.suggestion} searchSuggestion={searchSuggestion} />
    );
  }

  return (
    <ul className="search-card-results">
      {result.products.map(function renderProduct(product: Product) {
        return (
          <li className="search-card-product" key={product.id}>
            {product.name}
          </li>
        );
      })}
    </ul>
  );
}

type SuggestionButtonProps = {
  readonly suggestion: string;
  readonly searchSuggestion: (suggestion: string) => void;
};

function SuggestionButton({ suggestion, searchSuggestion }: SuggestionButtonProps) {
  function searchThisSuggestion() {
    searchSuggestion(suggestion);
  }

  return (
    <button className="search-card-suggestion" type="button" onClick={searchThisSuggestion}>
      <strong>{suggestion}</strong>
      {chooseObjectParticle(suggestion)} 입력하셨나요?
    </button>
  );
}

function chooseObjectParticle(word: string): string {
  const lastCode = word.charCodeAt(word.length - 1);
  const isHangulSyllable = lastCode >= FIRST_SYLLABLE_CODE && lastCode <= LAST_SYLLABLE_CODE;
  const hasFinalConsonant = isHangulSyllable && (lastCode - FIRST_SYLLABLE_CODE) % FINALS_PER_MEDIAL !== 0;

  return hasFinalConsonant ? '을' : '를';
}
