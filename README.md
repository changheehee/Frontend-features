# Frontend-features

웹사이트에 필요한 몇 가지 기능을 만들어 봤습니다.  
React·TypeScript를 사용했고, Express 서버와 연결했습니다.

## 기능

* 검색: 입력을 멈추면 검색 요청, 이전 요청 취소, 한글 자모 검색, 오타 제안
* 게시글: 무한 스크롤, 가상 목록, 관심 표시 및 저장 실패 시 복구
* 채팅: SSE 기반 메시지 수신, 재연결·재전송, 중복 저장 방지
* Worker: 메인 스레드와 Worker의 소요 시간·화면 반응 비교

서버 응답을 늦추거나 실패시켜서 각 기능이 어떻게 동작하는지도 확인할 수 있습니다.

## 실행

* `client`, `server` 폴더에서 각각 `npm install`
* 터미널을 두 개 열어 각 폴더에서 `npm run dev`
* [localhost:5173](http://localhost:5173) 접속

Windows에서는 설치 후 `start.cmd`로 함께 실행할 수 있습니다. 개발자 도구의 Console에서 요청·응답 로그를 볼 수 있습니다.

## 참고

* 기능 확인용 데모이며, 서버 데이터는 메모리에 저장됩니다. 서버를 재시작하면 초기화됩니다.
* 3D 모델: [Oiiaioooooiai Cat](https://sketchfab.com/3d-models/oiiaioooooiai-cat-30d27bf7fb224849b76e208a6eccdb36) © Zhuier, CC BY 4.0
* 사진: Unsplash · [사진별 출처](server/photos/SOURCES.md)
