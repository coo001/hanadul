import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDigits } from '../src/digits.js';

// Expected readings are written by hand (AGENTS.md rule 1).
const CASES = [
  ['010', '공일공'],
  ['010-1234-5678', '공일공 일이삼사 오육칠팔'],
  ['0', '공'],
  ['1', '일'], ['2', '이'], ['3', '삼'], ['4', '사'], ['5', '오'],
  ['6', '육'], ['7', '칠'], ['8', '팔'], ['9', '구'],
  ['02-987-6540', '공이 구팔칠 육오사공'],
];

test('reads digits one at a time and hyphens as one space', () => {
  for (const [input, want] of CASES) assert.equal(readDigits(input), want, input);
});

test('bad input throws a RangeError naming readDigits and showing the input', () => {
  const bad = ['', 'abc', '12a', '1 2', '+82', '१२', '-010', '010-', '010--1234', '-', '--', 5, undefined, {}, [], true, 7n];
  for (const b of bad) {
    assert.throws(
      () => readDigits(b),
      (e) => e instanceof RangeError && /readDigits/.test(e.message),
      String(b),
    );
  }
});

test('the error shows the input as typed', () => {
  assert.throws(() => readDigits('010--1'), (e) => e instanceof RangeError && e.message.includes('"010--1"'));
  assert.throws(() => readDigits(''), (e) => e instanceof RangeError && e.message.includes('""'));
});

test('readDigits(null) throws a RangeError naming readDigits and showing null', () => {
  assert.throws(() => readDigits(null), (e) => e instanceof RangeError && /readDigits/.test(e.message) && /null/.test(e.message));
});
