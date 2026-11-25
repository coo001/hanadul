import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readSino } from '../src/sino.js';

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

test('rejects input outside the range', () => {
  for (const bad of [-1, 10000, 1.5, NaN, '12', null]) {
    assert.throws(() => readSino(bad), RangeError, String(bad));
  }
});

test('the command prints the reading', () => {
  const out = execFileSync('node', ['bin/hanadul.js', '1234'], { encoding: 'utf8' });
  assert.equal(out, '천이백삼십사\n');
});

test('the command explains bad input and exits non-zero', () => {
  for (const [args, code] of [[[], 2], [['abc'], 2], [['-1'], 2], [['10000'], 1]]) {
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
