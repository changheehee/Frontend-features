import type { DataFlow } from '../frame/FlowDiagram.tsx';

export const CHAT_FLOW: DataFlow = {
  lanes: [
    { name: '클라이언트', detail: '사용자 1 · 사용자 2 화면' },
    { name: '서버', detail: 'Express · localhost:3001' },
  ],
  steps: [
    {
      type: 'message',
      from: 'left',
      label: 'GET /api/chat/events?lastId=0',
      detail: 'SSE 연결을 열어 두고 지난 메시지부터 순서대로 받습니다',
    },
    { type: 'note', side: 'left', text: '보내기는 한 번에 하나씩, 쓴 순서대로 보냅니다' },
    {
      type: 'message',
      from: 'left',
      label: 'POST /api/chat/messages { clientId, text }',
      detail: '같은 clientId가 다시 오면 새로 저장하지 않습니다',
    },
    {
      type: 'message',
      from: 'right',
      label: 'event: message { id: 4 }',
      detail: '두 화면 모두에게 보냅니다 · 보낸 쪽은 ✓',
    },
    {
      type: 'message',
      from: 'left',
      label: 'POST /api/chat/read { upToId: 4 }',
      detail: '받은 쪽이 알리면 보낸 쪽이 ✓✓로 바뀝니다',
    },
    { type: 'note', side: 'left', text: '끊겼다 다시 연결하면 lastId 다음 메시지부터 다시 받습니다' },
  ],
  caption: '두 화면은 한 페이지에 있지만 각자 따로 서버와 연결해 주고받습니다.',
};
