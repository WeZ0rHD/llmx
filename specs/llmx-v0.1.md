# LLMX v0.1 — Spec

> One memory. Every agent.

## Goal

Make project memory, decisions, tasks, skills and session summaries
**portable** between AI coding agents, with **Claude Code** and **Codex**
as the priority targets.

## Non-goals (v0)

- No cloud sync, no account system, no marketplace.
- No parsing of internal Claude/Codex conversation files.
- No raw conversation syncing. We sync **artefacts**, not chat logs.
- No Cursor / MiniMax integration yet.
- No automatic shell execution from shared context.

## On-disk format

A single directory at the project root, default name `project.llmx/`:

```
project.llmx/
├── manifest.json
├── memory/
│   ├── project-state.md
│   ├── decisions.jsonl
│   ├── tasks.json
│   └── preferences.json
├── sessions/
│   ├── latest.md
│   └── history.jsonl
├── skills/
│   ├── index.json
│   └── <name>/SKILL.md
├── agents/
│   └── default.json
├── tools/
│   └── mcp.json
└── logs/
    └── audit.jsonl
```

Two top-level files are rendered by `llmx export <agent>`:

- `AGENTS.md`   — read by Codex
- `CLAUDE.md`   — read by Claude Code

## Schemas (v0.1)

All schemas are defined in TypeScript with Zod. The canonical source of
truth is `src/core/schema.ts`.

| File                     | Format   | Mutability                            |
|--------------------------|----------|---------------------------------------|
| `manifest.json`          | JSON     | updated on init + agent list changes  |
| `decisions.jsonl`        | JSONL    | append-only                           |
| `tasks.json`             | JSON     | full rewrite on each mutation (atomic)|
| `sessions/history.jsonl` | JSONL    | append-only                           |
| `sessions/latest.md`     | Markdown | rewritten on each `session save`      |
| `skills/index.json`      | JSON     | updated on skill create/delete        |
| `skills/<n>/SKILL.md`    | Markdown | rewritten on skill create             |
| `tools/mcp.json`         | JSON     | user-edited                           |
| `logs/audit.jsonl`       | JSONL    | append-only                           |

## CLI surface (v0)

High priority:
- `llmx init`
- `llmx status`
- `llmx add-decision "..."` / `llmx decision add|list`
- `llmx task add|list|show|update`
- `llmx session save|list|show`
- `llmx export claude` / `llmx export codex` / `llmx export all`
- `llmx audit`

Medium priority (next milestones):
- `llmx skill create|list|show`
- `llmx sync --watch`

## MCP server (planned)

Stdio-based, exposes:

Tools: `get_project_state`, `get_tasks`, `add_task`, `update_task`,
`get_decisions`, `add_decision`, `get_latest_session`,
`save_session_summary`, `list_skills`, `get_skill`.

Resources: `llmx://memory/project-state`, `llmx://memory/tasks`,
`llmx://memory/decisions`, `llmx://sessions/latest`, `llmx://skills/index`.

## Security defaults (v0)

- Local-only mode is **on** by default (`tools/mcp.json`).
- `autoExecShell` is **off** by default.
- `.env` files are **never** read into shared context.
- Audit log entries have string values redacted using built-in patterns
  (OpenAI, GitHub, Google, AWS, Slack, PEM private keys).
- Skill names are validated to lowercase + `-`/`_` only; `..` and `/` at
  start are rejected.

## Versioning

- `manifest.llmxVersion` follows `llmx` releases.
- `manifest.schemaVersion` is the on-disk schema version (currently `1`).
- Breaking changes bump `schemaVersion` and ship a migrator in a
  follow-up release.
