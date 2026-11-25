// Sino-Korean (한자어) number readings.

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const UNITS = ['', '십', '백', '천'];

/**
 * Read an integer from 0 to 9999 in Sino-Korean.
 * A leading 1 is silent before 십, 백 and 천: 10 is "십", 1100 is "천백".
 * @param {number} n
 * @returns {string}
 */
export function readSino(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new RangeError(`readSino expects an integer from 0 to 9999, got ${n}`);
  }
  if (n === 0) return '영';
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
