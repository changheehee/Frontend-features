import { lazy } from 'react';
import type { CardEntry } from './frame/Card.tsx';
import { SearchCard } from './search/SearchCard.tsx';
import searchArt from './search/searchArt.png';
import { SEARCH_FLOW } from './search/searchFlow.ts';
import searchIcon from './search/searchIcon.svg';
import threadArt from './thread/threadArt.png';
import { THREAD_FLOW } from './thread/threadFlow.ts';
import threadIcon from './thread/threadIcon.svg';

const ThreadCard = lazy(function loadThreadCard() {
  return import('./thread/ThreadCard.tsx').then(function pickThreadCard(module) {
    return { default: module.ThreadCard };
  });
});

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
  {
    id: 'thread',
    title: '메인 스레드와 Worker',
    summary: '무거운 계산이 화면을 멈추게 하는지 메인 스레드와 Worker를 비교합니다.',
    art: threadArt,
    icon: threadIcon,
    tone: '#7a4dff',
    notes: [
      '같은 소수 세기를 메인 스레드와 Worker에서 차례로 실행합니다.',
      '메인 스레드에서 계산하는 동안에는 고양이와 재생 막대가 멈추고, Worker에서는 계속 움직입니다.',
      '화면이 멈춘 최대 시간은 프레임 사이 간격으로 직접 잽니다.',
      '걸린 시간은 PC 상태에 따라 달라지고, 비교의 핵심은 화면이 멈춘 시간입니다.',
      'three.js는 이 카드를 열 때만 내려받습니다.',
      '3D 모델: Oiiaioooooiai Cat © Zhuier (Sketchfab, CC BY 4.0)',
    ],
    flow: THREAD_FLOW,
    Content: ThreadCard,
  },
];
