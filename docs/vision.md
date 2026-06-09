# LLMX — Vision

> One memory. Every agent.

## Problem

AI coding agents (Claude Code, Codex, Cursor, future agents) start every
session from zero. You explain your project, your decisions, your tasks
— over and over. Switching agents means rebuilding the same context.

## Promise

LLMX is a small, local-first, open format and toolchain that lets a
project's AI context travel with the project:

- **`.llmx/`** — a portable directory holding the project's shared
  memory: state, decisions, tasks, skills, session summaries.
- **`llmx` CLI** — local engine to read, write, and render that context.
- **LLMX MCP server** — exposes the same context to any MCP-compatible
  agent, no copy-paste required.
- **Adapters** — re-render `CLAUDE.md`, `AGENTS.md`, and friends from
  the canonical store.

The first job is to prove the **Claude Code ↔ Codex handoff**: I can
start a feature in Claude Code, capture the relevant artefacts, switch
to Codex, and Codex already knows the project.

## Why a directory and not a database

- A directory is readable in any text editor, in any language, with no
  runtime.
- It diffs cleanly in git.
- It works offline, on a plane, on a USB stick.
- We can sync it however we want later (rsync, git, IPFS, whatever) —
  the format stays the same.

## Design principles

1. **Local-first.** No account, no server, no telemetry. Default to
   offline.
2. **Pareto MVP.** Ship the 20% that proves 80% of the value: state,
   tasks, decisions, sessions, skills, two adapters, one MCP server.
3. **Human-readable.** Markdown for prose, JSON for structured data,
   JSONL for append-only logs.
4. **Append-only when it matters.** Decisions, sessions and audit
   entries are append-only — they survive any re-export.
5. **Regenerable derived artefacts.** `CLAUDE.md` and `AGENTS.md` are
   derived; the source of truth is always `project.llmx/`.
6. **Secure by default.** No shell exec, no `.env` reads, secrets
   redacted from logs.

## What we are NOT building (yet)

- Cloud sync / accounts
- Skill marketplace
- Internal-format parsers for Claude/Codex
- Raw conversation syncing
- Web dashboard
- Complex database

## Long-term shape

If the format sticks, expect:

- More adapters (Cursor, Aider, Continue, …)
- A small public registry of canonical skill names
- Optional remote sync over plain git remotes
- Interop tests so other agents can self-test against LLMX
