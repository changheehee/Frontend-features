import type { RequestHandler } from 'express';
import { saveChatMessage, saveChatRead, sendChatTyping, streamChatEvents } from './cards/chat.ts';
import { savePostLike, sendPostPage, sendPostPhoto } from './cards/posts.ts';
import { sendSearchResult } from './cards/search.ts';

type CardEntry = {
  readonly path: string;
  readonly method: 'get' | 'post' | 'put';
  readonly sendResponse: RequestHandler;
};

export const CARD_LIST: readonly CardEntry[] = [
  { path: 'search', method: 'get', sendResponse: sendSearchResult },
  { path: 'posts', method: 'get', sendResponse: sendPostPage },
  { path: 'posts/:postId/like', method: 'put', sendResponse: savePostLike },
  { path: 'posts/photos/:fileName', method: 'get', sendResponse: sendPostPhoto },
  { path: 'chat/events', method: 'get', sendResponse: streamChatEvents },
  { path: 'chat/messages', method: 'post', sendResponse: saveChatMessage },
  { path: 'chat/read', method: 'post', sendResponse: saveChatRead },
  { path: 'chat/typing', method: 'post', sendResponse: sendChatTyping },
];
