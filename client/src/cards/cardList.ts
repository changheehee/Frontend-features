import type { CardEntry } from './Card.tsx';
import { SearchCard } from './search/SearchCard.tsx';
import searchArt from './search/searchArt.png';
import searchIcon from './search/searchIcon.svg';

export const CARD_LIST: readonly CardEntry[] = [
  {
    id: 'search',
    title: '검색 기능',
    summary: '서버를 늦추거나 실패시켜도 결과가 꼬이지 않는지 확인합니다.',
    art: searchArt,
    icon: searchIcon,
    notes: '입력을 멈추고 0.3초가 지나면 서버에 검색을 요청합니다. 응답을 받기 전에 검색어를 바꾸거나 패널을 닫으면 진행 중인 요청을 취소합니다. 요청이 실패하면 다시 시도 버튼으로 재요청할 수 있습니다.',
    Content: SearchCard,
  },
];
