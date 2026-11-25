// Pure helpers for the runner, kept apart so they can be unit tested.

// The runner may write code, tests and docs. It may not change its own rules,
// itself, the workflows that run it or the package manifest.
const ALLOWED = [/^src\/[\w./-]+$/, /^test\/[\w./-]+$/, /^bin\/[\w./-]+$/, /^docs\/[\w./-]+$/, /^web\/[\w./-]+$/, /^README\.md$/];

/** @returns {string} a description of the problem, or '' when every path is allowed */
export function checkPaths(paths) {
  const bad = paths.filter((p) => typeof p !== 'string' || p.includes('..') || !ALLOWED.some((re) => re.test(p)));
  return bad.length ? `These paths are outside what the factory may write: ${bad.map((p) => JSON.stringify(p)).join(', ')}` : '';
}

export function isAllowed(path) {
  return checkPaths([path]) === '';
}

// Which files the model sees first when they don't all fit.
const CONTEXT_ORDER = ['src/', 'bin/', 'test/', 'web/', 'docs/', 'README.md'];

/**
 * Pick the files whose full contents go into the prompt, in CONTEXT_ORDER, until
 * their total length would pass budget. The rest are only named.
 * @param {{path: string, content: string}[]} files
 * @returns {{shown: {path: string, content: string}[], notShown: string[]}}
 */
export function selectContext(files, budget) {
  const rank = (p) => CONTEXT_ORDER.findIndex((prefix) => p.startsWith(prefix));
  const sorted = [...files].sort((a, b) => rank(a.path) - rank(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const shown = [];
  const notShown = [];
  let used = 0;
  for (const f of sorted) {
    if (used + f.content.length <= budget) {
      shown.push(f);
      used += f.content.length;
    } else {
      notShown.push(f.path);
    }
  }
  return { shown, notShown };
}

/**
 * The model may only replace an existing file it was shown in full.
 * @param {Set<string>} shown paths whose full contents were in the prompt
 * @param {(path: string) => boolean} exists whether the path already existed before the runner wrote it
 * @returns {string} a description of the problem, or ''
 */
export function checkOverwrites(paths, shown, exists) {
  const bad = [...new Set(paths)].filter((p) => !shown.has(p) && exists(p));
  return bad.length ? `These files already exist but their full contents were not shown, so they may not be replaced: ${bad.map((p) => JSON.stringify(p)).join(', ')}` : '';
}

const DECISIONS = new Set(['fixed', 'not a problem']);

/**
 * In review mode the reply must answer every finding of the review.
 * @param {{files: unknown[], findings: {finding: string, decision: string, reason: unknown}[]}} reply from parseReply
 * @param {number} expected the number of findings in the review
 * @returns {string} a description of the problem, or ''
 */
/**
 * @param {(file: {path: string, content: string}) => boolean} [isUnchanged] true when writing
 *   this file would leave its current content as it is
 */
export function checkReviewReply(reply, expected, isUnchanged = () => false) {
  const { files, findings } = reply;
  if (findings.length !== expected) {
    return `The review has ${expected} finding(s) but the reply answers ${findings.length}. Give exactly one "findings" entry per review finding, each with "finding", "decision" and "reason" strings.`;
  }
  const bad = [];
  findings.forEach((f, i) => {
    if (f.finding.trim() === '') bad.push(`entry ${i + 1} has an empty "finding"`);
    if (!DECISIONS.has(f.decision)) bad.push(`entry ${i + 1} has decision ${JSON.stringify(f.decision)}; use "fixed" or "not a problem"`);
    if (typeof f.reason !== 'string' || f.reason.trim() === '') bad.push(`entry ${i + 1} needs a "reason"`);
  });
  if (bad.length) return `The review findings are not all answered: ${bad.join('; ')}.`;
  if (findings.some((f) => f.decision === 'fixed') && !files.some((f) => !isUnchanged(f))) {
    return 'A finding is marked "fixed" but the reply changes no files (every file it sends has its current content).';
  }
  return '';
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

export function buildPrompt({ issue, review, reviewCount, rules, tracked, shown, notShown }) {
  const system = [
    'You are the coding agent of a small software factory. You implement exactly one ticket.',
    'Follow the project rules below. Do only what the ticket asks; anything else belongs in a new ticket.',
    'Reply with one JSON object and nothing else:',
    '{ "files": [{ "path": "...", "content": "the complete new content of the file" }],',
    '  "summary": "two or three plain sentences on what changed",',
    '  "criteria": [{ "text": "an acceptance criterion copied from the ticket", "evidence": "the test name that checks it" }],',
    '  "findings": [{ "finding": "...", "decision": "fixed | not a problem", "reason": "what the code shows" }] }',
    'Give every changed or new file in full. You may write under src/, test/, bin/, docs/, web/ and README.md only.',
    'You may replace an existing file only if its full contents are shown below. Files listed as not shown must not be written.',
    'Tests use node:test and node:assert/strict. Expected Korean readings in tests are written by hand as literal strings.',
    '"findings" is only for review mode; otherwise leave it empty.',
  ].join('\n');
  const user = [
    `# Ticket #${issue.number}: ${issue.title}`, issue.body,
    '# Project rules (AGENTS.md)', rules,
    '# Files in the repository', tracked.join('\n'),
    ...shown.map((s) => `# ${s.path} (full contents)\n${s.content}`),
    ...(notShown.length ? ['# Not shown (over the size budget; do not write these)', notShown.join('\n')] : []),
    ...(review ? ['# Code review of the current change', review,
      `The review has ${reviewCount} finding(s). Check each one against the code above and give exactly one "findings" entry for each. Fix the ones that are real. For the others, say why they are not a problem. If nothing needs to change, return "files": [].`] : []),
  ].join('\n\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/**
 * Turn chat messages into what `claude -p` takes: one system prompt and one prompt.
 * Earlier turns (a rejected reply and the feedback on it) are written out in order.
 */
export function toClaudePrompt(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system');
  if (turns.length === 1) return { system, prompt: turns[0].content };
  const label = { user: 'Request', assistant: 'Your earlier reply' };
  return { system, prompt: turns.map((m) => `## ${label[m.role] ?? m.role}\n\n${m.content}`).join('\n\n') };
}

/** The JSON object in a model reply, without Markdown code fences or text around it. */
export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start === -1 || end < start ? text.trim() : text.slice(start, end + 1);
}

/**
 * The commit a Qodo summary comment reviewed. Qodo puts it in a hidden marker,
 * `<!-- https://github.com/<owner>/<repo>/commit/<sha> -->`, and moves it each
 * time it edits the comment for a newer commit. null when there is none.
 */
export function reviewedCommit(reviewComment) {
  const m = /<!--\s*https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/commit\/([0-9a-f]{40})\s*-->/.exec(reviewComment);
  return m ? m[1] : null;
}
