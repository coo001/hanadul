import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClaudePrompt, extractJson, checkPaths, parseReply, countFindings, stripHtml, isCopied, testCommand, fileList, selectContext, checkOverwrites, checkReviewReply, buildPrompt } from '../factory/lib.mjs';

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

test('the checks copy the working tree without git, runner output or the trusted runner', () => {
  for (const p of ['', 'src', 'src/sino.js', 'test/x.test.js', 'package.json', '.github/workflows/factory.yml', '.gitignore']) assert.equal(isCopied(p), true, p);
  for (const p of ['.git', '.git/config', '.factory', '.factory/log.md', '.factory-trusted', '.factory-trusted/factory/lib.mjs']) assert.equal(isCopied(p), false, p);
});

test('with a test user the checks run through sudo with an empty environment', () => {
  const env = { PATH: '/usr/bin:/bin', GH_TOKEN: 'secret', HOME: '/home/runner' };
  assert.deepEqual(testCommand(env, 'factorytest'), {
    cmd: 'sudo',
    args: ['-n', '-u', 'factorytest', 'env', '-i', 'PATH=/usr/bin:/bin', 'HOME=/tmp', 'npm', 'test'],
    env: { PATH: '/usr/bin:/bin' },
  });
});

test('without a test user the checks run npm test with secrets removed', () => {
  const env = { PATH: '/usr/bin', GH_TOKEN: 't', API_KEY: 'k', MY_SECRET: 's', HOME: '/home/me' };
  assert.deepEqual(testCommand(env, undefined), { cmd: 'npm', args: ['test'], env: { PATH: '/usr/bin', HOME: '/home/me' } });
  assert.deepEqual(testCommand(env, ''), testCommand(env, undefined));
});

test('the list of written files has each path once, one per line', () => {
  assert.equal(fileList(['test/b.test.js', 'src/a.js', 'test/b.test.js']), 'src/a.js\ntest/b.test.js\n');
  assert.equal(fileList([]), '');
});

const finding = (decision, reason = 'the code shows it') => ({ finding: 'a finding', decision, reason });

test('a review reply answers every finding with a decision and a reason', () => {
  const file = [{ path: 'src/a.js', content: 'x' }];
  assert.equal(checkReviewReply({ files: file, findings: [finding('fixed'), finding('not a problem')] }, 2), '');
  assert.equal(checkReviewReply({ files: [], findings: [finding('not a problem')] }, 1), '');
  assert.equal(checkReviewReply({ files: [], findings: [] }, 0), '');
});

test('a review reply that leaves findings unanswered is refused', () => {
  const file = [{ path: 'src/a.js', content: 'x' }];
  assert.match(checkReviewReply({ files: [], findings: [] }, 2), /has 2 finding\(s\) but the reply answers 0/);
  assert.match(checkReviewReply({ files: file, findings: [finding('fixed')] }, 2), /answers 1/);
  assert.match(checkReviewReply({ files: file, findings: [finding('fixed'), finding('fixed'), finding('fixed')] }, 2), /answers 3/);
  assert.match(checkReviewReply({ files: file, findings: [{ ...finding('fixed'), finding: ' ' }] }, 1), /empty "finding"/);
  assert.match(checkReviewReply({ files: file, findings: [finding('maybe')] }, 1), /decision "maybe"/);
  assert.match(checkReviewReply({ files: file, findings: [finding('fixed', '')] }, 1), /needs a "reason"/);
  assert.match(checkReviewReply({ files: file, findings: [finding('fixed', 5)] }, 1), /needs a "reason"/);
  assert.match(checkReviewReply({ files: [], findings: [finding('fixed')] }, 1), /marked "fixed" but the reply changes no files/);
});

test('file contents go into the prompt in order until the budget is used, the rest are named', () => {
  const f = (path, n) => ({ path, content: 'x'.repeat(n) });
  const { shown, notShown } = selectContext([f('README.md', 10), f('test/a.test.js', 30), f('src/b.js', 40), f('src/a.js', 20), f('docs/d.md', 5)], 95);
  assert.deepEqual(shown.map((s) => s.path), ['src/a.js', 'src/b.js', 'test/a.test.js', 'docs/d.md']);
  assert.deepEqual(notShown, ['README.md']);
  assert.deepEqual(selectContext([f('src/big.js', 100)], 99), { shown: [], notShown: ['src/big.js'] });
});

test('an existing file may only be replaced if it was shown in full', () => {
  const exists = (p) => p !== 'src/new.js';
  assert.equal(checkOverwrites(['src/a.js', 'src/new.js'], new Set(['src/a.js']), exists), '');
  assert.match(checkOverwrites(['src/a.js', 'src/big.js'], new Set(['src/a.js']), exists), /not shown.*"src\/big\.js"/);
});

test('the prompt holds the shown files in full and names the others', () => {
  const [system, user] = buildPrompt({
    issue: { number: 1, title: 't', body: 'b' }, review: 'Bugs (2)', reviewCount: 2, rules: 'r', tracked: ['src/a.js', 'src/big.js'],
    shown: [{ path: 'src/a.js', content: 'export const a = 1;\n' }], notShown: ['src/big.js'],
  });
  assert.match(system.content, /only if its full contents are shown/);
  assert.match(user.content, /# src\/a\.js \(full contents\)\nexport const a = 1;/);
  assert.match(user.content, /# Not shown[^\n]*\n+src\/big\.js/);
  assert.match(user.content, /The review has 2 finding\(s\)/);
});

test('checkPaths rejects a path with a trailing newline', () => {
  // JavaScript's $ matches only at the end of the string, so "src/a.js\n" is not allowed.
  assert.notEqual(checkPaths(['src/a.js\n']), '');
  assert.notEqual(checkPaths(['README.md\n']), '');
});

test('checkReviewReply does not count files sent back unchanged as a fix', () => {
  const reply = { files: [{ path: 'src/a.js', content: 'x\n' }], findings: [{ finding: 'f', decision: 'fixed', reason: 'r' }] };
  assert.match(checkReviewReply(reply, 1, () => true), /changes no files/);
  assert.equal(checkReviewReply(reply, 1, () => false), '');
});

test('toClaudePrompt keeps the system prompt apart and writes out earlier turns', () => {
  const first = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }];
  assert.deepEqual(toClaudePrompt(first), { system: 'S', prompt: 'U' });
  const retry = [...first, { role: 'assistant', content: '{"a":1}' }, { role: 'user', content: 'That did not pass.' }];
  const { system, prompt } = toClaudePrompt(retry);
  assert.equal(system, 'S');
  assert.match(prompt, /^## Request\n\nU\n\n## Your earlier reply\n\n\{"a":1\}\n\n## Request\n\nThat did not pass\.$/);
});

test('extractJson takes the object out of code fences and surrounding text', () => {
  assert.equal(extractJson('```json\n{"a":{"b":1}}\n```'), '{"a":{"b":1}}');
  assert.equal(extractJson('Here it is: {"a":1} done'), '{"a":1}');
  assert.equal(extractJson('OK'), 'OK');
});
