// Native Korean (고유어) number readings.

const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

/**
 * Read an integer from 1 to 99 in native Korean numerals.
 * Native numerals have no zero and stop at 99; from 100 up Korean uses
 * Sino-Korean, so anything else throws instead of guessing.
 * @param {number} n
 * @returns {string}
 */
export function readNative(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new RangeError(`readNative expects an integer from 1 to 99, got ${String(n)}`);
  }
  return TENS[Math.floor(n / 10)] + ONES[n % 10];
}
