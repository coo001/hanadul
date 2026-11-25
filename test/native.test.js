import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNative } from '../src/native.js';

// Expected readings are written by hand (AGENTS.md rule 1).
const CASES = [
  [1, '하나'], [2, '둘'], [3, '셋'], [4, '넷'], [5, '다섯'],
  [6, '여섯'], [7, '일곱'], [8, '여덟'], [9, '아홉'], [10, '열'],
  [11, '열하나'], [12, '열둘'], [15, '열다섯'], [19, '열아홉'],
  [20, '스물'], [21, '스물하나'], [30, '서른'], [33, '서른셋'],
  [40, '마흔'], [50, '쉰'], [60, '예순'], [70, '일흔'], [80, '여든'],
  [90, '아흔'], [99, '아흔아홉'],
];

test('reads 1 to 99 in native Korean numerals', () => {
  for (const [n, want] of CASES) assert.equal(readNative(n), want, `readNative(${n})`);
});

test('every reading from 1 to 99 is different', () => {
  const seen = new Set();
  for (let n = 1; n <= 99; n++) seen.add(readNative(n));
  assert.equal(seen.size, 99);
});

test('rejects 0, 100 and anything that is not an integer', () => {
  for (const bad of [0, 100, -3, 2.5, NaN, '7', 7n, null, undefined]) {
    assert.throws(() => readNative(bad), RangeError, String(bad));
  }
});
