import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPaths, parseReply, countFindings, stripHtml } from '../factory/lib.mjs';

test('the factory may write code, tests and docs', () => {
  assert.equal(checkPaths(['src/digits.js', 'test/digits.test.js', 'README.md', 'docs/spec.md']), '');
});

test('the factory may not write its own rules, itself, workflows or the manifest', () => {
  for (const p of ['AGENTS.md', 'factory/run-ticket.mjs', '.github/workflows/factory.yml', 'package.json', 'src/../AGENTS.md', '/etc/passwd', 'src/', 42]) {
    assert.match(checkPaths([p]), /outside what the factory may write/, String(p));
  }
});

test('a reply needs files and a summary', () => {
  const ok = parseReply(JSON.stringify({ files: [{ path: 'src/a.js', content: 'x' }], summary: ' done ', criteria: [{ text: 'a', evidence: 'b' }, { text: 1 }] }));
  assert.equal(ok.summary, 'done');
  assert.equal(ok.criteria.length, 1);
  assert.deepEqual(ok.findings, []);
  for (const bad of ['not json', '{}', '{"files":[{"path":1,"content":"x"}],"summary":"s"}', '{"files":[],"summary":""}']) {
    assert.throws(() => parseReply(bad), Error, bad);
  }
});

test('findings are counted from a Qodo review summary', () => {
  assert.equal(countFindings('<code>🐞 Bugs (0)</code> <code>📘 Rule violations (0)</code> <code>📎 Requirement gaps (0)</code>'), 0);
  assert.equal(countFindings('Bugs (2) Rule violations (1) Requirement gaps (0)'), 3);
  assert.equal(countFindings('Thanks for the PR!'), null);
});

test('review HTML is reduced to text', () => {
  assert.equal(stripHtml('<h3>Code Review</h3>\n\n<!-- hidden -->\n<code>Bugs (1)</code>'), 'Code Review \n Bugs (1)');
});
