import type { Request, Response } from 'express';

type Product = {
  readonly id: string;
  readonly name: string;
};

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

    response.json({ products: findProductsContaining(keyword) });
  }

  function cancelResult() {
    clearTimeout(timerId);
  }
}

function findProductsContaining(keyword: string): readonly Product[] {
  if (keyword === '') {
    return ALL_PRODUCTS;
  }

  return ALL_PRODUCTS.filter(function hasKeyword(product) {
    return product.name.includes(keyword);
  });
}
