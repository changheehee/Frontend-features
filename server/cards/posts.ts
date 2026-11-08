import path from 'node:path';
import type { Request, Response } from 'express';

type Post = {
  readonly id: number;
  readonly title: string;
  readonly place: string;
  readonly minutesAgo: number;
  readonly price: number;
  readonly photoUrl: string;
  readonly likeCount: number;
  readonly isLiked: boolean;
};

type BasePost = {
  readonly title: string;
  readonly place: string;
  readonly price: number;
  readonly photoName: string;
  readonly likeCount: number;
};

const POST_COUNT = 10_000;
const PHOTO_DIRECTORY = path.join(import.meta.dirname, '..', 'photos');

const BASE_POSTS: readonly BasePost[] = [
  { title: '원목 책상과 의자 세트', place: '역삼동', price: 120000, photoName: 'desk', likeCount: 7 },
  { title: '아이 자전거 16인치 (보조바퀴 포함)', place: '망원동', price: 45000, photoName: 'bike', likeCount: 3 },
  { title: '캠핑 의자 2개 일괄', place: '성수동', price: 30000, photoName: 'camping-chair', likeCount: 2 },
  { title: '전기 포트 1.7L 거의 새것', place: '서교동', price: 18000, photoName: 'kettle', likeCount: 11 },
  { title: '겨울 패딩 화이트 M', place: '연남동', price: 55000, photoName: 'puffer', likeCount: 5 },
  { title: '보드게임 모음 (구성품 완벽)', place: '합정동', price: 15000, photoName: 'board-game', likeCount: 0 },
  { title: '핑크 스탠드 조명', place: '역삼동', price: 12000, photoName: 'lamp', likeCount: 1 },
  { title: '블루투스 스피커 생활방수', place: '망원동', price: 25000, photoName: 'speaker', likeCount: 4 },
  { title: '몬스테라 화분 (분갈이 완료)', place: '성수동', price: 20000, photoName: 'plant', likeCount: 9 },
  { title: '필름 카메라 작동 확인 완료', place: '서교동', price: 160000, photoName: 'film-camera', likeCount: 15 },
  { title: '기계식 키보드 갈축', place: '연남동', price: 70000, photoName: 'keyboard', likeCount: 6 },
  { title: '캔버스 운동화 260', place: '합정동', price: 20000, photoName: 'sneakers', likeCount: 2 },
  { title: '통기타 입문용 (케이스 포함)', place: '역삼동', price: 90000, photoName: 'guitar', likeCount: 8 },
  { title: '커피 그라인더 전동', place: '망원동', price: 65000, photoName: 'coffee-grinder', likeCount: 3 },
  { title: '1인 소파 옐로우', place: '성수동', price: 80000, photoName: 'armchair', likeCount: 12 },
  { title: '무선 헤드폰 노이즈캔슬링', place: '서교동', price: 110000, photoName: 'headphones', likeCount: 7 },
  { title: '가죽 백팩 브라운', place: '연남동', price: 40000, photoName: 'backpack', likeCount: 1 },
  { title: '수제 도자기 컵 나눔해요', place: '합정동', price: 0, photoName: 'cup', likeCount: 4 },
  { title: '아날로그 손목시계 메탈', place: '역삼동', price: 50000, photoName: 'watch', likeCount: 2 },
  { title: '크루저 보드 오렌지', place: '망원동', price: 35000, photoName: 'skateboard', likeCount: 6 },
];

const posts: Post[] = Array.from({ length: POST_COUNT }, createPost);

export function sendPostPage(request: Request, response: Response) {
  const cursor = Number(request.query.cursor);
  const limit = Number(request.query.limit);
  const delayMilliseconds = Number(request.query.delayMilliseconds);
  const shouldFail = request.query.fail === 'true';

  const timerId = setTimeout(sendPage, delayMilliseconds);
  response.on('close', cancelPage);

  function sendPage() {
    if (shouldFail) {
      response.status(500).json({ message: '서버 오류를 재현했습니다.' });
      return;
    }

    const nextCursor = cursor + limit;

    response.json({
      posts: posts.slice(cursor, nextCursor),
      nextCursor: nextCursor < posts.length ? nextCursor : null,
    });
  }

  function cancelPage() {
    clearTimeout(timerId);
  }
}

export function savePostLike(request: Request, response: Response) {
  const postIndex = Number(request.params.postId) - 1;
  const isLiked = request.body.isLiked as boolean;
  const delayMilliseconds = Number(request.query.delayMilliseconds);
  const shouldFail = request.query.fail === 'true';

  const timerId = setTimeout(finishSaving, delayMilliseconds);
  response.on('close', cancelSaving);

  function finishSaving() {
    if (shouldFail) {
      response.status(500).json({ message: '저장 실패를 재현했습니다.' });
      return;
    }

    const post = posts[postIndex]!;
    const savedPost = { ...post, isLiked, likeCount: countLikes(post, isLiked) };
    posts[postIndex] = savedPost;
    response.json({ isLiked: savedPost.isLiked, likeCount: savedPost.likeCount });
  }

  function cancelSaving() {
    clearTimeout(timerId);
  }
}

export function sendPostPhoto(request: Request, response: Response) {
  response.sendFile(request.params.fileName as string, { root: PHOTO_DIRECTORY });
}

function createPost(_value: unknown, index: number): Post {
  const basePost = BASE_POSTS[index % BASE_POSTS.length]!;
  const round = Math.floor(index / BASE_POSTS.length);

  return {
    id: index + 1,
    title: basePost.title,
    place: basePost.place,
    minutesAgo: 2 + index * 3,
    price: basePost.price === 0 ? 0 : basePost.price + (round % 7) * 1000,
    photoUrl: `/api/posts/photos/${basePost.photoName}.jpg`,
    likeCount: basePost.likeCount + (round % 5),
    isLiked: false,
  };
}

function countLikes(post: Post, isLiked: boolean): number {
  if (post.isLiked === isLiked) {
    return post.likeCount;
  }

  if (isLiked) {
    return post.likeCount + 1;
  }

  return post.likeCount - 1;
}
