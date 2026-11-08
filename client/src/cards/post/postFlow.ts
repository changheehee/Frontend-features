import type { DataFlow } from '../frame/FlowDiagram.tsx';

export const POST_FLOW: DataFlow = {
  lanes: [
    { name: '클라이언트', detail: 'React · localhost:5173' },
    { name: '서버', detail: 'Express · localhost:3001' },
  ],
  steps: [
    {
      type: 'message',
      from: 'left',
      label: 'GET /api/posts?cursor=0&limit=10',
      detail: '어디서부터 몇 개를 받을지 정해 요청합니다',
    },
    {
      type: 'message',
      from: 'right',
      label: '{ posts, nextCursor: 10 }',
      detail: '다음에 이어 받을 위치를 같이 보냅니다 · 마지막이면 null',
    },
    { type: 'note', side: 'left', text: '끝 200px 전에 닿으면 다음 페이지 · 화면에는 보이는 행만 그립니다' },
    { type: 'note', side: 'left', text: '하트를 누르면 응답을 기다리지 않고 화면부터 바꿉니다' },
    {
      type: 'message',
      from: 'left',
      label: 'PUT /api/posts/3/like { isLiked: true }',
      detail: '글마다 저장 요청은 한 번에 하나입니다',
    },
    {
      type: 'message',
      from: 'right',
      label: '{ isLiked, likeCount }',
      detail: '실패(500)면 화면을 서버 값으로 되돌립니다',
    },
  ],
  caption: null,
};
