# Agents

## Commit messages

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message, and every PR title, uses this format:

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Use for                                                        |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new user-facing feature                                      |
| `fix`      | A bug fix                                                      |
| `docs`     | Documentation only                                             |
| `style`    | Formatting, whitespace, semicolons; no change in behavior      |
| `refactor` | Code change that neither fixes a bug nor adds a feature        |
| `perf`     | Performance improvement                                        |
| `test`     | Adding or correcting tests                                     |
| `build`    | Build system or dependencies                                   |
| `ci`       | CI configuration and scripts                                   |
| `chore`    | Maintenance that doesn't touch source or tests (tooling, config) |
| `revert`   | Reverts a previous commit                                      |

No other types.

### Rules

- **Scope** is optional and free-form: a short lowercase noun for the area touched, e.g. `feat(chat): ...`. Add one when a single area is clearly affected; omit it when the change is cross-cutting.
- **Description**: imperative mood ("add", not "added"/"adds"), lowercase first letter, no trailing period, 72 characters or fewer for the whole header line.
- **Body**: optional. Separate from the header with a blank line; explain *what* and *why*, not *how*. Wrap at 72 characters.
- **Breaking changes**: add `!` before the colon (`feat(api)!: ...`) **and** a `BREAKING CHANGE: <explanation>` footer.
- **Footers**: `Refs: <issue>`, `Closes: <issue>`, and `Co-Authored-By:` trailers go in the footer, after a blank line.
- **One logical change per commit.** If the message needs "and" to describe two unrelated things, split the commit.
- **PR titles** use the same `<type>(<scope>): <description>` format, so squash-merges land as conventional commits.

### Examples

```
feat(chat): add typing indicator
fix: prevent duplicate messages on reconnect
docs: document local issue tracker conventions
refactor(auth)!: replace session tokens with JWTs

BREAKING CHANGE: clients must send a bearer token instead of the session cookie.
```

## Agent skills

The engineering skills from [mattpocock/skills](https://github.com/mattpocock/skills) are copied into `.claude/skills/`, so they load automatically for anyone opening this repo in Claude Code. To update them, re-copy from upstream.

### Issue tracker

Issues and specs live as local markdown files under `plan/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

Completed local issues use `Status: implemented`. This is a terminal lifecycle
state, not a triage label, and prevents completed plans from being picked up as
new work.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
