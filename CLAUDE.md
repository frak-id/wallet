# CLAUDE.md

The repo compass is [`AGENTS.md`](./AGENTS.md). Read it first — it carries the quick
commands, the "Where to Look" table, the non-obvious patterns and the anti-patterns,
and it is the file that is kept current. Per-area detail lives in the child
`AGENTS.md` files it links to.

Do not duplicate `AGENTS.md` content here: a second compass only drifts.

## Claude Code specifics

- Skills: `.claude/skills/frak-orchestrator` routes multi-area development tasks to a
  specialist agent; `.claude/skills/code-quality` runs the quality gate. Simple
  questions need neither.
- Agents: `.claude/agents/`.
