# Agents

## Agent skills

The engineering skills from [mattpocock/skills](https://github.com/mattpocock/skills) are copied into `.claude/skills/`, so they load automatically for anyone opening this repo in Claude Code. To update them, re-copy from upstream.

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
