// Native Korean (고유어) number readings.

const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

// Before a counter, four ones and the word for 20 are shortened.
const BEFORE_COUNTER = { 하나: '한', 둘: '두', 셋: '세', 넷: '네' };

// Text for an error message that can never throw itself.
function show(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return String(value);
  } catch {
    return typeof value;
  }
}

/**
 * Read an integer from 1 to 99 in native Korean numerals.
 * Native numerals have no zero and stop at 99; from 100 up Korean uses
 * Sino-Korean, so anything else throws instead of guessing.
 *
 * With `beforeCounter`, returns the form used in front of a counter such as
 * 개, 명, 시 or 살: 3 is "세" and 20 is "스무". Only exactly 20 changes;
 * 21 is "스물한".
 * @param {number} n
 * @param {{ beforeCounter?: boolean }} [options]
 * @returns {string}
 */
export function readNative(n, options = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new RangeError(`readNative expects an integer from 1 to 99, got ${show(n)}`);
  }
  if (typeof options !== 'object' || options === null) {
    throw new RangeError(`readNative expects options to be an object, got ${show(options)}`);
  }
  const beforeCounter = options.beforeCounter ?? false;
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  if (!beforeCounter) return tens + ones;
  if (n === 20) return '스무';
  return tens + (BEFORE_COUNTER[ones] ?? ones);
}
