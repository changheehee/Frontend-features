import { lazy } from 'react';
import { ChatCard } from './chat/ChatCard.tsx';
import chatArt from './chat/chatArt.png';
import { CHAT_FLOW } from './chat/chatFlow.ts';
import chatIcon from './chat/chatIcon.svg';
import type { CardEntry } from './frame/Card.tsx';
import { PostCard } from './post/PostCard.tsx';
import postArt from './post/postArt.png';
import { POST_FLOW } from './post/postFlow.ts';
import postIcon from './post/postIcon.svg';
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
      '자모로 나눠 비교해서 입력 중인 “바나나ㅇ”도 바나나우유를 찾습니다.',
      '결과가 없으면 가장 가까운 이름을 “○○를 입력하셨나요?”로 제안합니다.',
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
  {
    id: 'post',
    title: '게시글',
    summary: '글 1만 개를 끝없이 불러와도 화면에는 보이는 행만 그립니다.',
    art: postArt,
    icon: postIcon,
    tone: '#d6336c',
    notes: [
      '목록 끝 200px 전에 다음 페이지를 불러오고, 실패하면 다시 시도로만 재요청합니다.',
      '보이는 행만 그리고, ‘전부’로 바꾸면 그리는 시간과 스크롤 중 멈춤을 비교할 수 있습니다.',
      '하트는 화면부터 바꾸고, 저장에 실패하면 되돌린 뒤 알려 줍니다.',
      '사진: Unsplash 무료 사진',
    ],
    flow: POST_FLOW,
    Content: PostCard,
  },
  {
    id: 'chat',
    title: '채팅',
    summary: '두 화면이 실시간으로 주고받고, 끊겼다 이어져도 순서를 지킵니다.',
    art: chatArt,
    icon: chatIcon,
    tone: '#12a37f',
    notes: [
      '두 화면이 각자 SSE로 서버에 연결해 메시지를 실시간으로 받습니다.',
      '보낸 메시지는 시계 → ✓ → ✓✓로 바뀌고, 실패하면 다시 보낼 수 있습니다.',
      '연결이 끊긴 동안 쓴 메시지는 다시 연결되면 순서대로 보냅니다.',
      '같은 메시지를 두 번 보내도 서버가 한 번만 저장합니다.',
    ],
    flow: CHAT_FLOW,
    Content: ChatCard,
  },
];
