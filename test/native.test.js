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

// Forms used in front of a counter, written by hand.
const BEFORE_COUNTER = [
  [1, '한'], [2, '두'], [3, '세'], [4, '네'], [5, '다섯'], [9, '아홉'], [10, '열'],
  [11, '열한'], [12, '열두'], [13, '열세'], [14, '열네'], [15, '열다섯'],
  [20, '스무'], [21, '스물한'], [22, '스물두'], [23, '스물세'], [24, '스물네'],
  [25, '스물다섯'], [30, '서른'], [31, '서른한'], [44, '마흔네'], [99, '아흔아홉'],
];

test('shortens 1 to 4 and 20 in front of a counter', () => {
  for (const [n, want] of BEFORE_COUNTER) {
    assert.equal(readNative(n, { beforeCounter: true }), want, `readNative(${n}, beforeCounter)`);
  }
});

test('only the ones 1 to 4 and exactly 20 change in front of a counter', () => {
  for (let n = 1; n <= 99; n++) {
    const plain = readNative(n);
    const short = readNative(n, { beforeCounter: true });
    const changes = n === 20 || [1, 2, 3, 4].includes(n % 10);
    assert.equal(short !== plain, changes, `n=${n}: ${plain} / ${short}`);
  }
});

test('the plain reading is unchanged when the option is off or missing', () => {
  assert.equal(readNative(3), '셋');
  assert.equal(readNative(3, undefined), '셋');
  assert.equal(readNative(3, {}), '셋');
  assert.equal(readNative(20, { beforeCounter: false }), '스물');
});

test('the counter form rejects the same inputs as the plain one', () => {
  for (const bad of [0, 100, 2.5]) {
    assert.throws(() => readNative(bad, { beforeCounter: true }), RangeError, String(bad));
  }
});

test('a null options argument throws a RangeError naming readNative and the value', () => {
  assert.throws(() => readNative(3, null), (e) => {
    assert.ok(e instanceof RangeError);
    assert.match(e.message, /readNative/);
    assert.match(e.message, /got null/);
    return true;
  });
});

test('options that are not an object throw a RangeError naming readNative and the value', () => {
  for (const [bad, shown] of [[3, 'got 3'], ['x', 'got "x"'], [true, 'got true']]) {
    assert.throws(() => readNative(3, bad), (e) => {
      assert.ok(e instanceof RangeError, String(bad));
      assert.match(e.message, /readNative/);
      assert.ok(e.message.includes(shown), e.message);
      return true;
    }, String(bad));
  }
});

test('null in every argument position gives a RangeError, never a TypeError', () => {
  assert.throws(() => readNative(null), RangeError);
  assert.throws(() => readNative(null, null), RangeError);
  assert.throws(() => readNative(3, null), RangeError);
});
