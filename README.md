# LLMX

[![CI](https://github.com/WeZ0rHD/llmx/actions/workflows/ci.yml/badge.svg)](https://github.com/WeZ0rHD/llmx/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/llmx)](https://www.npmjs.com/package/llmx)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **One memory. Every agent.**

Stop re-explaining your project to your AI. LLMX is a local-first
format and CLI that lets your project context travel with your project —
across **Claude Code**, **Codex**, **Cursor**, and any agent that
speaks MCP.

![demo](https://placeholder.invalid/llmx-demo.gif)

---

## What it does

AI coding agents start every session from zero. You re-explain the
stack, the decisions, the open tasks. LLMX fixes that with a single
`.llmx/` directory at your project root:

```
project.llmx/
├── manifest.json
├── memory/        project state, decisions, tasks, preferences
├── sessions/      latest summary + history
├── skills/        reusable SKILL.md files
├── agents/        per-agent config
├── tools/         mcp.json + security config
└── logs/          audit.jsonl
```

A human-readable, git-friendly, **plain-text** directory. No database,
no server, no account, no telemetry.

---

## Why it matters

- **Switch agents without losing context.** Start a feature in Claude
  Code, hand off to Codex — it already knows the project.
- **Version-control your AI memory.** Every decision, every task, every
  session summary is a git diff away.
- **Own your context.** Local-first, no vendor lock-in, no SaaS.
- **MCP-native.** The LLMX MCP server exposes the same context to any
  MCP-compatible agent — no copy-paste.

---

## Install

```bash
npm install -g llmx
```

_(or `pnpm add -g llmx` / `yarn global add llmx`)_

## Quickstart

```bash
cd my-project
llmx init                                  # creates project.llmx/
llmx add-decision "Use PostgreSQL"         # record a decision
llmx task add "Implement auth"             # add a task
llmx session save "Started auth scaffold"  # snapshot the session
llmx export claude                         # render CLAUDE.md
llmx export codex                          # render AGENTS.md
llmx doctor                                # integrity check
```

The next time you open Claude Code or Codex, they read
`CLAUDE.md` / `AGENTS.md` and **already know your project.**

---

## MCP server (v0.2)

LLMX ships an stdio MCP server. Add to your Claude Code config:

```json
{
  "mcpServers": {
    "llmx": {
      "command": "llmx",
      "args": ["mcp"]
    }
  }
}
```

Then use tools like `llmx_status`, `llmx_read_decision`,
`llmx_list_sessions` from any MCP-compatible agent.

---

## Design principles

1. **Local-first.** No account, no server, no telemetry. Default offline.
2. **Pareto MVP.** The 20% that proves 80% of the value, shipped.
3. **Human-readable.** Markdown for prose, JSON for structured data,
   JSONL for append-only logs.
4. **Append-only when it matters.** Decisions, sessions, audit survive
   any re-export.
5. **Regenerable derived artefacts.** `CLAUDE.md` and `AGENTS.md` are
   derived — the source of truth is always `project.llmx/`.
6. **Secure by default.** No shell exec, no `.env` reads, secrets
   redacted from logs.

## What we are NOT building (yet)

- Cloud sync / accounts
- A skill marketplace
- Internal-format parsers for Claude / Codex
- Raw conversation syncing
- A web dashboard
- A complex database

## Status

**v0.2 shipped** (June 2026) — `llmx init`, the MCP server, and the
Claude Code ↔ Codex handoff. See [`specs/llmx-v0.1.md`](specs/llmx-v0.1.md)
for the full spec.

## License

MIT — see [LICENSE](LICENSE).
