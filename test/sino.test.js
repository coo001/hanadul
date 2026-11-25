import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readSino, MAX_SINO } from '../src/sino.js';

const CASES = [
  [0, '영'], [1, '일'], [9, '구'],
  [10, '십'], [11, '십일'], [20, '이십'], [99, '구십구'],
  [100, '백'], [101, '백일'], [110, '백십'], [111, '백십일'], [205, '이백오'],
  [1000, '천'], [1001, '천일'], [1100, '천백'], [1234, '천이백삼십사'],
  [2026, '이천이십육'], [9999, '구천구백구십구'],
];

test('reads 0 to 9999 in Sino-Korean', () => {
  for (const [n, want] of CASES) assert.equal(readSino(n), want, `readSino(${n})`);
});

test('every reading from 0 to 9999 is different', () => {
  const seen = new Set();
  for (let n = 0; n <= 9999; n++) seen.add(readSino(n));
  assert.equal(seen.size, 10000);
});

// Expected readings are written by hand (AGENTS.md rule 1).
const LARGE = [
  [10000, '만'], [10001, '만 일'], [11000, '만 천'], [20000, '이만'],
  [100000, '십만'], [110000, '십일만'], [1000000, '백만'], [10000000, '천만'],
  [12345678, '천이백삼십사만 오천육백칠십팔'],
  [100000000, '일억'], [100010000, '일억 만'], [100000001, '일억 일'],
  [1234567898, '십이억 삼천사백오십육만 칠천팔백구십팔'],
  [1000000000000, '일조'], [1000000010000, '일조 만'],
  [51840000, '오천백팔십사만'],
  [9007199254740993n, '구천칠조 천구백구십이억 오천사백칠십사만 구백구십삼'],
  [MAX_SINO, '구천구백구십구조 구천구백구십구억 구천구백구십구만 구천구백구십구'],
];

test('reads up to 9999조 with 만, 억 and 조, spaced by group', () => {
  for (const [n, want] of LARGE) assert.equal(readSino(n), want, `readSino(${n})`);
});

test('a number and the same bigint read the same', () => {
  for (const n of [0, 7, 10000, 12345678, Number.MAX_SAFE_INTEGER]) {
    assert.equal(readSino(BigInt(n)), readSino(n));
  }
});

test('rejects input outside the range', () => {
  for (const bad of [-1, -1n, MAX_SINO + 1n, 2 ** 53, 1e20, 1.5, NaN, '12', null, undefined]) {
    assert.throws(() => readSino(bad), RangeError, String(bad));
  }
});

test('the command prints the reading', () => {
  const out = execFileSync('node', ['bin/hanadul.js', '1234'], { encoding: 'utf8' });
  assert.equal(out, '천이백삼십사\n');
});

test('the command explains bad input and exits non-zero', () => {
  for (const [args, code] of [[[], 2], [['abc'], 2], [['-1'], 2], [['10000000000000000'], 1]]) {
    const r = spawnSync('node', ['bin/hanadul.js', ...args], { encoding: 'utf8' });
    assert.equal(r.status, code, args.join(' '));
    assert.notEqual(r.stderr, '');
    assert.equal(r.stdout, '');
  }
});

test('the command does not read leading zeros as a smaller number', () => {
  const r = spawnSync('node', ['bin/hanadul.js', '007'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /"007"/);
});

test('the error quotes the input as typed', () => {
  const typed = '99999999999999999999';
  const r = spawnSync('node', ['bin/hanadul.js', typed], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(`"${typed}"`));
});

test('the command reads numbers above the safe integer range exactly', () => {
  const out = execFileSync('node', ['bin/hanadul.js', '9007199254740993'], { encoding: 'utf8' });
  assert.equal(out, '구천칠조 천구백구십이억 오천사백칠십사만 구백구십삼\n');
});
