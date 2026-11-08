import type { Request, Response } from 'express';
import { measureEditDistance, splitIntoJamo } from './koreanText.ts';

type Product = {
  readonly id: string;
  readonly name: string;
};

type NameDistance = {
  readonly name: string;
  readonly prefixDistance: number;
  readonly fullDistance: number;
};

const JAMO_PER_ALLOWED_TYPO = 3;

const ALL_PRODUCTS: readonly Product[] = [
  { id: 'apple', name: '사과' },
  { id: 'apple-jam', name: '사과잼' },
  { id: 'pear', name: '배' },
  { id: 'banana', name: '바나나' },
  { id: 'banana-milk', name: '바나나우유' },
  { id: 'grape', name: '포도' },
  { id: 'grape-juice', name: '포도주스' },
  { id: 'tangerine', name: '귤' },
];

export function sendSearchResult(request: Request, response: Response) {
  const keyword = (request.query.keyword as string).trim();
  const delayMilliseconds = Number(request.query.delayMilliseconds);
  const shouldFail = request.query.fail === 'true';

  const timerId = setTimeout(sendResult, delayMilliseconds);
  response.on('close', cancelResult);

  function sendResult() {
    if (shouldFail) {
      response.status(500).json({ message: '서버 오류를 재현했습니다.' });
      return;
    }

    const products = findProductsContaining(keyword);
    const suggestion = products.length === 0 ? suggestClosestName(keyword) : null;
    response.json({ products, suggestion });
  }

  function cancelResult() {
    clearTimeout(timerId);
  }
}

function findProductsContaining(keyword: string): readonly Product[] {
  const keywordJamo = splitIntoJamo(keyword);

  return ALL_PRODUCTS.filter(function hasKeyword(product) {
    return splitIntoJamo(product.name).includes(keywordJamo);
  });
}

function suggestClosestName(keyword: string): string | null {
  const keywordJamo = splitIntoJamo(keyword);
  const allowedTypos = Math.max(1, Math.floor(keywordJamo.length / JAMO_PER_ALLOWED_TYPO));
  const closest = ALL_PRODUCTS.map(function measureName(product): NameDistance {
    const nameJamo = splitIntoJamo(product.name);

    return {
      name: product.name,
      prefixDistance: measureEditDistance(keywordJamo, nameJamo.slice(0, keywordJamo.length)),
      fullDistance: measureEditDistance(keywordJamo, nameJamo),
    };
  }).sort(compareDistance)[0]!;

  return closest.prefixDistance <= allowedTypos ? closest.name : null;
}

function compareDistance(first: NameDistance, second: NameDistance): number {
  return first.prefixDistance - second.prefixDistance || first.fullDistance - second.fullDistance;
}
