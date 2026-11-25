# The factory

How a ticket becomes a pull request without anyone opening a coding session.

## Trigger

Add the label `ready-for-agent` to an issue. `.github/workflows/factory.yml`
starts on GitHub's runners. (It can also be started from the Actions tab with
an issue number.) One ticket runs at a time.

## What runs

`factory/run-ticket.mjs`:

1. Reads the issue with `gh issue view`.
2. Sends the ticket, `AGENTS.md` and the current source files to a model
   through GitHub Models, using the workflow's own token. No API key is stored
   in the repository.
3. Refuses any file outside `src/`, `test/`, `bin/`, `docs/`, `web/` and
   `README.md`. The runner cannot edit `AGENTS.md`, `factory/`, the workflows
   or `package.json`.
4. Writes the files and runs `npm test` with every token removed from the
   environment, because this is where model-written code executes.
5. If the reply is malformed, a path is refused or a test fails, sends the
   problem back and tries again. Three attempts in total.

Then the workflow either:

- pushes `factory/issue-<n>`, opens a PR whose description links the ticket
  and lists its acceptance criteria, and moves the label to `in-review`; or
- posts the run log on the issue and moves the label to `needs-human`.

## Review

Qodo reviews the PR. `.github/workflows/factory-review.yml` reads Qodo's
comment:

- no findings: it says so on the PR and waits;
- findings: the runner gets the review text, checks each finding against the
  code, fixes the ones it confirms and explains the ones it rejects. After two
  fix rounds it stops and adds `needs-human`.

## What stays with a person

Merging. Writing tickets. Anything labelled `needs-human`. Changes to
`AGENTS.md`, `factory/` and `.github/`.

## Limits

- The free GitHub Models tier caps request size, so this only suits small
  tickets in a small codebase.
- A PR opened with the workflow token does not start other workflows. The
  tests are run inside the runner before the PR is opened.
- Passing tests and a clean review do not show the ticket is done. The model
  wrote both the code and its tests.

## Why GitHub Actions and GitHub Models

The trigger has to work with no machine of mine switched on, and cost nothing.
A scheduled job on a laptop needs the laptop awake and a paid agent login on
it. Actions on a public repository and the Models free tier need neither.

## Try the runner locally

    ISSUE_FILE=issue.json FACTORY_STUB=replies.json node factory/run-ticket.mjs

`ISSUE_FILE` is the JSON `gh issue view --json number,title,body,url` prints;
`FACTORY_STUB` is a JSON array of canned model replies, one per attempt.
Nothing is pushed.
