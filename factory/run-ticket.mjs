#!/usr/bin/env node
// The factory runner: one ticket in, a checked change in the working tree out.
// It never pushes, opens a PR or merges. The workflow does the first two after
// this script reports "ok", and a person does the third.
//
//   ISSUE=12 REPO=owner/name GH_TOKEN=... node factory/run-ticket.mjs
//
// With REVIEW_FILE set, the model also gets the text of a code review and is
// asked to check each finding against the code before changing anything.
// Result: .factory/status ("ok" or "stuck"), .factory/pr-body.md, .factory/log.md,
// .factory/files.txt (every path the runner wrote, one per line; the workflows
// stage only these).
//
// Repository files are read and written relative to the working directory, so
// the workflow can run a trusted copy of this script against another checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPaths, parseReply, buildPrompt, stripHtml, isCopied, testCommand, fileList } from './lib.mjs';

const { ISSUE, REPO, GH_TOKEN, REVIEW_FILE, FACTORY_STUB } = process.env;
const MODEL = process.env.FACTORY_MODEL || 'openai/gpt-4.1';
const MAX_ATTEMPTS = Number(process.env.FACTORY_MAX_ATTEMPTS || 3); // first try + 2 retries
const log = [];
const note = (line) => { log.push(line); console.log(line); };
const written = new Set();

function finish(status, prBody = '') {
  mkdirSync('.factory', { recursive: true });
  writeFileSync('.factory/status', status);
  writeFileSync('.factory/pr-body.md', prBody);
  writeFileSync('.factory/files.txt', status === 'ok' ? fileList([...written]) : '');
  writeFileSync('.factory/log.md', log.join('\n') + '\n');
  process.exit(0);
}

function readIssue() {
  if (process.env.ISSUE_FILE) return JSON.parse(readFileSync(process.env.ISSUE_FILE, 'utf8'));
  const out = execFileSync('gh', ['issue', 'view', ISSUE, '-R', REPO, '--json', 'number,title,body,url'], { encoding: 'utf8' });
  return JSON.parse(out);
}

async function askModel(messages, attempt) {
  if (FACTORY_STUB) {
    const replies = JSON.parse(readFileSync(FACTORY_STUB, 'utf8'));
    return replies[Math.min(attempt - 1, replies.length - 1)];
  }
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0, response_format: { type: 'json_object' } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`model request failed with HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text).choices[0].message.content;
  } catch {
    throw new Error(`model reply was not the expected JSON: ${text.slice(0, 300)}`);
  }
}

// Model-written code runs here, so it gets no tokens and works on a copy:
// nothing the tests write reaches the real checkout. With FACTORY_TEST_USER set
// (CI) it also runs as that user, who cannot read this process's environment.
function runChecks() {
  const testUser = process.env.FACTORY_TEST_USER;
  const root = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), 'factory-checks-'));
  try {
    cpSync(root, dir, { recursive: true, filter: (src) => isCopied(relative(root, src)) });
    // Readable by the test user, writable only by the runner.
    if (testUser) execFileSync('chmod', ['-R', 'a+rX,go-w', dir]);
    const { cmd, args, env } = testCommand(process.env, testUser);
    const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env, timeout: 120_000 });
    // Nothing started by the tests may outlive them (it could watch later commands).
    if (testUser) spawnSync('sudo', ['-n', 'pkill', '-KILL', '-u', testUser]);
    return { ok: r.status === 0, output: (r.stdout + r.stderr).slice(-3000) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const issue = readIssue();
const review = REVIEW_FILE ? stripHtml(readFileSync(REVIEW_FILE, 'utf8')).slice(0, 6000) : '';
note(`Ticket #${issue.number}: ${issue.title}`);
note(`Model: ${FACTORY_STUB ? 'stub' : MODEL}. Attempts allowed: ${MAX_ATTEMPTS}.${review ? ' Mode: review findings.' : ''}`);

const messages = buildPrompt({
  issue, review, rules: read('AGENTS.md'), tracked,
  sources: tracked.filter((p) => /^(src|bin)\//.test(p)).map((p) => ({ path: p, content: read(p) })),
  exampleTest: read('test/native.test.js').slice(0, 1500),
});

let reply;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  let problem;
  try {
    reply = parseReply(await askModel(messages, attempt));
    problem = checkPaths(reply.files.map((f) => f.path));
  } catch (err) {
    problem = err.message;
  }
  if (!problem && reply.files.length === 0 && !review) problem = 'The reply changed no files.';
  if (!problem) {
    for (const f of reply.files) {
      mkdirSync(dirname(f.path), { recursive: true });
      writeFileSync(f.path, f.content.endsWith('\n') ? f.content : f.content + '\n');
      written.add(f.path);
    }
    const checks = runChecks();
    note(`Attempt ${attempt}: wrote ${reply.files.map((f) => f.path).join(', ') || 'nothing'}; npm test ${checks.ok ? 'passed' : 'failed'}.`);
    if (checks.ok) {
      const body = [
        review ? `Follow-up to the review on this PR, for #${issue.number}.` : `Closes #${issue.number}`,
        '', '## What this does', reply.summary,
        '', `## Acceptance criteria (from #${issue.number})`,
        ...reply.criteria.map((c) => `- [x] ${c.text}\n  - ${c.evidence}`),
        ...(review ? ['', '## Review findings', ...reply.findings.map((f) => `- ${f.finding}: **${f.decision}**. ${f.reason}`)] : []),
        '', '## How it was checked',
        `\`npm test\` passed on attempt ${attempt} of ${MAX_ATTEMPTS}. No person has run this change yet.`,
        '', `Written by the factory runner (\`factory/run-ticket.mjs\`, model \`${FACTORY_STUB ? 'stub' : MODEL}\`) from the ticket and AGENTS.md. A person decides whether to merge.`,
      ].join('\n');
      finish('ok', body);
    }
    problem = `npm test failed:\n${checks.output}`;
  } else {
    note(`Attempt ${attempt}: rejected before writing. ${problem.split('\n')[0]}`);
  }
  messages.push({ role: 'assistant', content: JSON.stringify(reply ?? {}) });
  messages.push({ role: 'user', content: `That did not pass. ${problem}\nReply again with the complete JSON, including every file in full.` });
}
note(`Stopped after ${MAX_ATTEMPTS} attempts. A person needs to look.`);
execFileSync('git', ['checkout', '--', '.']);
execFileSync('git', ['clean', '-fdq', '--exclude=.factory']);
finish('stuck');
