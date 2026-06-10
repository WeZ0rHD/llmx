# LLMX

[![CI](https://github.com/WeZ0rHD/llmx/actions/workflows/ci.yml/badge.svg)](https://github.com/WeZ0rHD/llmx/actions/workflows/ci.yml)

> **One memory. Every agent.**

LLMX is an open context layer that makes project memory, tasks, decisions, skills and session summaries portable between AI coding agents like Claude Code, Codex, Cursor and future agents.

## Status

v0 — early MVP. Local-first, single-machine, focused on the Claude Code ↔ Codex handoff.

## Install (dev)

```bash
npm install
npm run build
```

## Quickstart

```bash
llmx init
llmx add-decision "Use PostgreSQL for relational data"
llmx task add "Implement authentication"
llmx session save "Initialized project and defined first architecture"
llmx status
llmx doctor           # integrity check on project.llmx/
llmx export claude
llmx export codex
```

## Layout

```
project.llmx/
├── manifest.json
├── memory/        project state, decisions, tasks, preferences
├── sessions/      latest summary + history
├── skills/        reusable skills (SKILL.md)
├── agents/        per-agent config
├── tools/         mcp.json + security config
└── logs/          audit.jsonl
```

## License

MIT
