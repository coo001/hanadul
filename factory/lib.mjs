// Pure helpers for the runner, kept apart so they can be unit tested.

// The runner may write code, tests and docs. It may not change its own rules,
// itself, the workflows that run it or the package manifest.
const ALLOWED = [/^src\/[\w./-]+$/, /^test\/[\w./-]+$/, /^bin\/[\w./-]+$/, /^docs\/[\w./-]+$/, /^web\/[\w./-]+$/, /^README\.md$/];

/** @returns {string} a description of the problem, or '' when every path is allowed */
export function checkPaths(paths) {
  const bad = paths.filter((p) => typeof p !== 'string' || p.includes('..') || !ALLOWED.some((re) => re.test(p)));
  return bad.length ? `These paths are outside what the factory may write: ${bad.map((p) => JSON.stringify(p)).join(', ')}` : '';
}

// Top-level entries of the checkout that are not copied into the checks' temp dir.
const NOT_COPIED = new Set(['.git', '.factory', '.factory-trusted']);

/** @param {string} relPath a path relative to the repository root */
export function isCopied(relPath) {
  return !NOT_COPIED.has(relPath.split(/[\\/]/)[0]);
}

/**
 * How to run the checks on model-written code.
 * With testUser (CI), npm test runs as that user with an empty environment, so it
 * cannot read this process's environment through /proc. Without it (local runs),
 * secrets are only removed from the child's environment; that is not isolation.
 */
export function testCommand(env, testUser) {
  if (testUser) {
    return { cmd: 'sudo', args: ['-n', '-u', testUser, 'env', '-i', `PATH=${env.PATH ?? ''}`, 'HOME=/tmp', 'npm', 'test'], env: { PATH: env.PATH ?? '' } };
  }
  return { cmd: 'npm', args: ['test'], env: Object.fromEntries(Object.entries(env).filter(([k]) => !/TOKEN|SECRET|KEY/i.test(k))) };
}

/** The contents of .factory/files.txt: each written path once, one per line. */
export function fileList(paths) {
  return [...new Set(paths)].sort().map((p) => `${p}\n`).join('');
}

/** Parse the model's JSON reply and insist on the fields the runner uses. */
export function parseReply(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The reply was not valid JSON.');
  }
  const files = data?.files;
  if (!Array.isArray(files) || files.some((f) => typeof f?.path !== 'string' || typeof f?.content !== 'string')) {
    throw new Error('The reply needs "files": an array of { "path", "content" } with string values.');
  }
  if (typeof data.summary !== 'string' || data.summary.trim() === '') throw new Error('The reply needs a "summary" string.');
  const list = (v, a, b) => (Array.isArray(v) ? v.filter((x) => typeof x?.[a] === 'string' && typeof x?.[b] === 'string') : []);
  return { files, summary: data.summary.trim(), criteria: list(data.criteria, 'text', 'evidence'), findings: list(data.findings, 'finding', 'decision').map((f) => ({ reason: '', ...f })) };
}

export function stripHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** Count the findings in a Qodo review comment. null when the comment is not a review summary. */
export function countFindings(reviewComment) {
  const counts = [...reviewComment.matchAll(/(Bugs|Rule violations|Requirement gaps) \((\d+)\)/g)];
  if (counts.length === 0) return null;
  return counts.reduce((sum, m) => sum + Number(m[2]), 0);
}

export function buildPrompt({ issue, review, rules, tracked, sources, exampleTest }) {
  const system = [
    'You are the coding agent of a small software factory. You implement exactly one ticket.',
    'Follow the project rules below. Do only what the ticket asks; anything else belongs in a new ticket.',
    'Reply with one JSON object and nothing else:',
    '{ "files": [{ "path": "...", "content": "the complete new content of the file" }],',
    '  "summary": "two or three plain sentences on what changed",',
    '  "criteria": [{ "text": "an acceptance criterion copied from the ticket", "evidence": "the test name that checks it" }],',
    '  "findings": [{ "finding": "...", "decision": "fixed | not a problem", "reason": "what the code shows" }] }',
    'Give every changed or new file in full. You may write under src/, test/, bin/, docs/, web/ and README.md only.',
    'Tests use node:test and node:assert/strict. Expected Korean readings in tests are written by hand as literal strings.',
    '"findings" is only for review mode; otherwise leave it empty.',
  ].join('\n');
  const user = [
    `# Ticket #${issue.number}: ${issue.title}`, issue.body,
    '# Project rules (AGENTS.md)', rules,
    '# Files in the repository', tracked.join('\n'),
    ...sources.map((s) => `# ${s.path}\n${s.content}`),
    '# Style example from test/native.test.js', exampleTest,
    ...(review ? ['# Code review of the current change', review,
      'Check each finding against the code above. Fix the ones that are real. For the others, say why they are not a problem. If nothing needs to change, return "files": [].'] : []),
  ].join('\n\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
