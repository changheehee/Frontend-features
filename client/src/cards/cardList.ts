import type { CardEntry } from './frame/Card.tsx';
import { SearchCard } from './search/SearchCard.tsx';
import searchArt from './search/searchArt.png';
import { SEARCH_FLOW } from './search/searchFlow.ts';
import searchIcon from './search/searchIcon.svg';

export const CARD_LIST: readonly CardEntry[] = [
  {
    id: 'search',
    title: '검색 기능',
    summary: '서버를 늦추거나 실패시켜도 결과가 꼬이지 않는지 확인합니다.',
    art: searchArt,
    icon: searchIcon,
    tone: '#335fff',
    notes: [
      '입력을 0.3초 멈추면 요청하고, 그 전에 검색어가 바뀌면 이전 요청을 취소합니다.',
      '패널을 닫아도 진행 중인 요청을 취소합니다.',
    ],
    flow: SEARCH_FLOW,
    Content: SearchCard,
  },
];
