# The factory

How a ticket becomes a pull request without anyone opening a coding session.

## Trigger

Add the label `ready-for-agent` to an issue. `.github/workflows/factory.yml`
starts on GitHub's runners. (It can also be started from the Actions tab with
an issue number.) One ticket runs at a time.

## What runs

`factory/run-ticket.mjs`:

1. Reads the issue with `gh issue view`.
2. Sends the ticket, `AGENTS.md` and the full contents of the tracked files
   under `src/`, `bin/`, `test/`, `web/`, `docs/` and `README.md` (in that
   order, up to 60,000 characters; files past that are only named) to a model
   through Claude Code (`claude -p` with every tool turned off, so it can only
   answer in text). It signs in with the `CLAUDE_CODE_OAUTH_TOKEN` repository
   secret, a subscription token from `claude setup-token`; no API key is used.
   Only that step gets the secret, and the checks never see it.
3. Refuses any file outside `src/`, `test/`, `bin/`, `docs/`, `web/` and
   `README.md`. The runner cannot edit `AGENTS.md`, `factory/`, the workflows
   or `package.json`. It also refuses to replace an existing file the model was
   not shown in full.
4. Writes the files and runs `npm test` on a copy of the working tree, because
   this is where model-written code executes. See "Isolation".
5. If the reply is malformed, a path is refused or a test fails, sends the
   problem back and tries again. Three attempts in total. If all three fail, it
   undoes only what it wrote: tracked files are restored, new files and the
   directories it created for them (if now empty) are removed. Nothing else in
   the working tree is touched.

Then the workflow either:

- pushes `factory/issue-<n>`, opens a PR whose description links the ticket
  and lists its acceptance criteria, and moves the label to `in-review`; or
- posts the run log on the issue and moves the label to `needs-human`.

## Review

Qodo reviews the PR. `.github/workflows/factory-review.yml` reads Qodo's
comment:

- no findings: it says so on the PR and waits. If the PR head has a newer
  commit than the review comment (created or last edited), it says the review
  predates that commit instead, and waits for a new review;
- findings: the runner gets the review text and the number of findings,
  checks each finding against the code, fixes the ones it confirms and
  explains the ones it rejects. The reply must answer every finding with
  `fixed` or `not a problem` and a reason, and change at least one file if
  anything is `fixed`; otherwise the attempt counts as failed. After two fix
  rounds it stops.

Whenever the review workflow stops for a person, it adds `needs-human` to the
PR and moves the ticket from `in-review` to `needs-human`.

## Isolation

The runner holds a token with write access, and both a PR branch and the tests
the model writes are untrusted code.

- Trusted runner: `factory-review.yml` checks out the PR branch, then the
  default branch into `.factory-trusted/`, and runs only
  `.factory-trusted/factory/*.mjs` against the PR checkout. If the branch
  differs from the default branch in `factory/`, `.github/` or `AGENTS.md`, it
  comments, adds `needs-human` and runs nothing. `GH_TOKEN` is set only on the
  steps that call `gh` or the model.
- Separate user: on CI (`FACTORY_TEST_USER` set) the checks run as an
  unprivileged user created by the workflow, through
  `sudo -u <user> env -i PATH=... HOME=/tmp npm test`, so they cannot read the
  runner's environment through `/proc`. Processes that user leaves behind are
  killed afterwards.
- Copy, and staging by list: the checks run in a temp copy of the working tree
  (without `.git`, `.factory`, `.factory-trusted`) that the test user can read
  but not write. The runner lists every file it wrote in `.factory/files.txt`;
  the workflows stage only those, and if `git status` shows any other change
  they comment, add `needs-human` and push nothing.
- Claude Code runs in an empty temporary folder with project and local
  settings off, so a branch's `.claude/` settings, hooks, MCP servers or
  `CLAUDE.md` never load while it holds `CLAUDE_CODE_OAUTH_TOKEN`.

## What stays with a person

Merging. Writing tickets. Anything labelled `needs-human`. Changes to
`AGENTS.md`, `factory/` and `.github/`.

## Limits

- Each run uses the subscription's Claude usage, so a busy day of tickets can
  hit the plan's limits. The prompt is capped at 60,000 characters of files, so
  this suits small tickets in a small codebase.
- A PR opened with the workflow token does not start other workflows. The
  tests are run inside the runner before the PR is opened.
- Passing tests and a clean review do not show the ticket is done. The model
  wrote both the code and its tests.

## Why GitHub Actions and Claude Code

The trigger has to work with no machine of mine switched on. A scheduled job on
a laptop needs the laptop awake. Actions on a public repository cost nothing.
The runner first used GitHub Models with the workflow token, but GitHub retired
GitHub Models on 30 July 2026 (the endpoint now answers HTTP 200 with a plain
"OK"), so it calls Claude Code on the subscription that is already paid for.

## Try the runner locally

    ISSUE_FILE=issue.json FACTORY_STUB=replies.json node factory/run-ticket.mjs

`ISSUE_FILE` is the JSON `gh issue view --json number,title,body,url` prints;
`FACTORY_STUB` is a JSON array of canned model replies, one per attempt.
Nothing is pushed. Without `FACTORY_TEST_USER` the checks still run on a copy,
but as your own user with only secret-looking variables removed: a local run is
not isolated, so only run replies you are willing to execute.
