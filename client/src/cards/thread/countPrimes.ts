export function countPrimesBelow(limit: number): number {
  let primeCount = 0;

  for (let candidate = 2; candidate < limit; candidate++) {
    if (isPrime(candidate)) {
      primeCount++;
    }
  }

  return primeCount;
}

function isPrime(candidate: number): boolean {
  for (let divisor = 2; divisor * divisor <= candidate; divisor++) {
    if (candidate % divisor === 0) {
      return false;
    }
  }

  return true;
}
