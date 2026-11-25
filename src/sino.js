// Sino-Korean (한자어) number readings.

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const UNITS = ['', '십', '백', '천'];
const GROUPS = ['', '만', '억', '조'];

/** The largest number readSino reads: 9999조 9999억 9999만 9999. */
export const MAX_SINO = 9999_9999_9999_9999n;

// Reads 1 to 9999. A leading 1 is silent before 십, 백 and 천.
function readGroup(n) {
  let out = '';
  const digits = String(n);
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    const place = digits.length - 1 - i;
    if (d === 0) continue;
    out += (d === 1 && place > 0 ? '' : DIGITS[d]) + UNITS[place];
  }
  return out;
}

/**
 * Read an integer from 0 to 9999,9999,9999,9999 in Sino-Korean.
 * Groups of four digits are separated by a space (한글 맞춤법 제44항), and a
 * group that is zero is skipped. 10000 is "만", but 억 and 조 keep their 일:
 * 100000000 is "일억".
 * Pass a bigint for values above Number.MAX_SAFE_INTEGER.
 * @param {number | bigint} n
 * @returns {string}
 */
export function readSino(n) {
  let rest;
  if (typeof n === 'bigint') rest = n;
  else if (typeof n === 'number' && Number.isSafeInteger(n)) rest = BigInt(n);
  if (rest === undefined || rest < 0n || rest > MAX_SINO) {
    throw new RangeError(`readSino expects an integer from 0 to ${MAX_SINO}, got ${String(n)}`);
  }
  if (rest === 0n) return '영';
  const parts = [];
  for (let group = 0; rest > 0n; group++, rest /= 10000n) {
    const value = Number(rest % 10000n);
    if (value === 0) continue;
    const silentOne = value === 1 && group === 1;
    parts.unshift((silentOne ? '' : readGroup(value)) + GROUPS[group]);
  }
  return parts.join(' ');
}
