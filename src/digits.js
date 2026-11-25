// Digit-by-digit Sino-Korean readings, the way phone numbers are said.

const DIGITS = ['공', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

// Text for an error message that can never throw itself.
function show(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    if (Array.isArray(value)) return JSON.stringify(value) ?? 'array';
    return String(value);
  } catch {
    return typeof value;
  }
}

/**
 * Read a string of digits one digit at a time in Sino-Korean. 0 is "공".
 * A hyphen between groups becomes one space.
 * @param {string} text
 * @returns {string}
 */
export function readDigits(text) {
  if (typeof text !== 'string' || !/^[0-9]+(-[0-9]+)*$/.test(text)) {
    throw new RangeError(`readDigits expects digits 0-9 in groups separated by single hyphens, got ${show(text)}`);
  }
  let out = '';
  for (const ch of text) out += ch === '-' ? ' ' : DIGITS[Number(ch)];
  return out;
}
