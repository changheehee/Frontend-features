import type { DataFlow } from '../frame/FlowDiagram.tsx';

export const SEARCH_FLOW: DataFlow = {
  lanes: [
    { name: '클라이언트', detail: 'React · localhost:5173' },
    { name: '서버', detail: 'Express · localhost:3001' },
  ],
  steps: [
    { type: 'note', side: 'left', text: '입력을 0.3초 멈추면 요청을 보냅니다' },
    {
      type: 'message',
      from: 'left',
      label: 'GET /api/search?keyword=바나나',
      detail: '응답 지연·실패 설정도 함께 보냅니다',
    },
    {
      type: 'message',
      from: 'right',
      label: '{ products }',
      detail: '실패를 켜면 500',
    },
    { type: 'note', side: 'left', text: '응답 전에 검색어가 바뀌거나 패널을 닫으면 abort()' },
    {
      type: 'message',
      from: 'left',
      label: '연결 끊김',
      detail: '서버는 close 이벤트에서 응답 타이머를 지웁니다',
    },
  ],
  caption: null,
};
