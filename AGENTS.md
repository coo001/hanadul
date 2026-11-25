# AGENTS.md

Instructions for coding agents and reviewers working on hanadul.

## What this project is

hanadul reads numbers aloud in Korean for people learning the language: a
library (`src/`), a command (`bin/hanadul.js`) and, later, a web page (`web/`).
Korean has two number systems, Sino-Korean (일, 이, 삼) and native (하나, 둘,
셋), and the thing being counted decides which one is used. The output is the
words a Korean speaker would say, written in standard spelling.

## Setup and checks

Node 22 or newer. There is nothing to install.

    npm test                       # all unit tests, must pass before a PR
    node bin/hanadul.js 1234       # run the command by hand: 천이백삼십사

Before opening a PR, run `npm test` and run the changed behaviour by hand at
least once, including one input that should fail.

## House rules

### 1. The Say-It-Out-Loud Rule
Every reading rule comes with a table of `[input, expected reading]` rows in
`test/`, and the expected readings are written by hand from how the number is
actually said. Never produce the expected value by calling the code under test
or by copying its output.
- Applies to: anything in `src/` that returns Korean text, and its tests.
- Why: the code and a test generated from it agree with each other even when
  both are wrong. A reviewer who doesn't read Korean can only check the table.

### 2. The Quote-What-They-Typed Rule
An error message shows the input exactly as the user typed it, in quotes.
Validate the text before converting it to a number. The command exits with 2
when the arguments aren't understood and 1 when the input is understood but
can't be read. Nothing goes to stdout on failure.
- Applies to: `bin/` and, later, the web page's input handling.
- Why: converting first hid two problems on day one. `007` was read as "칠",
  and a 20-digit input came back in the error as a different number.

### 3. No network, no dependencies
Runtime code uses only what Node and the browser provide. No packages in
`dependencies`, no fetch calls, no fonts or scripts from another host.
- Applies to: `src/`, `bin/`, `web/`. Dev-only tooling needs a ticket first.
- Why: learners should be able to use it offline, and there is nothing to
  audit or update.

### 4. Standard spelling and spacing
Output follows the Korean spelling rules (한글 맞춤법). Large numbers are
spaced in units of 만: `12345678` is "천이백삼십사만 오천육백칠십팔". A counter
is separated from its number by a space: "세 시", "십오 분".
- Applies to: every string the library returns.
- Why: learners copy what they see. A reading that sounds right but is spaced
  wrong teaches a mistake.

### 5. One ticket, one branch, one PR
Work starts from a GitHub issue. One issue gets one branch and one PR. The PR
description links the issue and copies its acceptance criteria as a checklist.
If something outside the ticket looks wrong, open a new issue and leave it.
- Applies to: all changes, including documentation.
- Why: a small PR can be checked against its ticket line by line, by me and
  by the reviewer.

### 6. The No Stray Errors Rule
An exported function either returns a reading or throws a `RangeError` that
names the function and shows the input. That holds for every argument,
including an options argument that is `null` or the wrong type. No
`TypeError` from inside the function may reach the caller. Each exported
function has a test that passes `null` in every argument position.
- Applies to: every `export` in `src/`.
- Why: after PR #8, `readNative(3, null)` failed with "Cannot read properties
  of null (reading 'beforeCounter')". Five reviews and the acceptance tests
  were clean, because the ticket only listed bad numbers, not bad options.
  The caller sees an error about our internals instead of their input.

## When unsure

Don't guess a reading. If a rule of Korean is unclear, stop and ask in the
issue.
