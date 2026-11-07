import type { RequestHandler } from 'express';
import { sendSearchResult } from './cards/search.ts';

type CardEntry = {
  readonly id: string;
  readonly sendResponse: RequestHandler;
};

export const CARD_LIST: readonly CardEntry[] = [
  { id: 'search', sendResponse: sendSearchResult },
];
