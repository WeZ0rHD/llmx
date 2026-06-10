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
- `llmx doctor [--json]` — run self-checks (see [Doctor](#doctor-v01))

Medium priority (next milestones):
- `llmx skill create|list|show`
- `llmx sync --watch`

## Doctor (v0.1)

`llmx doctor` runs a battery of integrity checks on a `project.llmx/`
directory and reports `OK` / `WARN` / `ERROR` per check.

| Check | What it verifies | Severity if fails |
|---|---|---|
| `llmx-dir-exists` | `project.llmx/` is a directory | ERROR |
| `manifest-valid` | `manifest.json` parses and matches `ManifestSchema` | ERROR |
| `decisions-valid` | `memory/decisions.jsonl` is valid JSONL, one record per line | ERROR |
| `tasks-valid` | `memory/tasks.json` parses, task IDs unique | WARN if dupes |
| `sessions-valid` | `sessions/history.jsonl` is valid JSONL | ERROR |
| `audit-valid` | `logs/audit.jsonl` is valid JSONL | ERROR |
| `no-orphans` | no untracked files/dirs in `project.llmx/` | WARN |

Optional files on a fresh project (`decisions.jsonl`, `tasks.json`,
`audit.jsonl`, `sessions/history.jsonl`) report `ok` with a
"no X yet" detail.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | All checks OK |
| `1` | At least one WARN, no ERROR |
| `2` | At least one ERROR |

### Output

Human (default): one line per check with a `✓` / `⚠` / `✗` icon,
followed by a `Result: OK|WARN|ERROR` line.

Machine (`--json`): `{ "result": "ok|warn|error", "checks": [...] }`

## MCP server (planned)

Stdio-based, exposes:

Tools: `get_project_state`, `get_tasks`, `add_task`, `update_task`,
`get_decisions`, `add_decision`, `get_latest_session`,
`save_session_summary`, `list_skills`, `get_skill`.

Resources: `llmx://memory/project-state`, `llmx://memory/tasks`,
`llmx://memory/decisions`, `llmx://sessions/latest`, `llmx://skills/index`.

## v0.2 — MCP server (WIP)

The v0.2 release ships a working **stdio MCP server skeleton** built on
[`@modelcontextprotocol/sdk@^1.29`](https://www.npmjs.com/package/@modelcontextprotocol/sdk).
This section tracks the gap between what is in the repo today and the
full v0.2 surface listed above.

### What works now (v0.2 skeleton, shipped)

- `src/mcp/tools.ts` — canonical tool registry, exports `TOOLS` and
 `findTool(name)`. Handlers receive a `ToolContext` carrying a bound
 `Repository` and a stable actor name (`llmx-mcp`) for the audit log.
- `src/mcp/server.ts` — `createMcpServer(repo)` wires the registry onto
 an `McpServer` from the SDK; `startStdioServer(repo)` connects it to a
 `StdioServerTransport`.
- `src/mcp/index.ts` — entry point. Logs go to **stderr only** (stdout
 is the MCP wire protocol). Blocks until stdin EOFs.
- `src/cli/mcp.ts` — `llmx mcp [--dir <path>]` boots the server.
- `tests/mcp/tools.test.ts` —6 unit tests covering the tool registry
 contract and `createMcpServer` wiring.

### Baseline tools in v0.2

| Tool | Description |
|---|---|
| `llmx_status` | Manifest + counts (tasks/decisions/sessions). |
| `llmx_read_decision` | Read one decision by `id`, or list recent ones. |
| `llmx_list_sessions` | List recent session summaries (newest first). |

### What's NOT in v0.2 yet (gap to close)

- **Write tools**: `add_task`, `update_task`, `add_decision`,
 `save_session_summary` — only read-only tools are exposed today.
- **Resources**: `llmx://memory/*`, `llmx://sessions/latest`,
 `llmx://skills/index` — not registered yet (SDK supports them via
 `server.registerResource`).
- **Prompts**: no MCP prompts in v0.2.
- **Auth / OAuth**: none — local-only stdio server, relying on the
 process boundary for trust.
- **Tests for the stdio transport itself**: we cover the tool
 registry structurally; a full end-to-end test would require spawning
 the server and driving it via the SDK's `Client` + `StdioClientTransport`.
 Tracked for v0.2.1.
- **Audit log integration**: handlers can be audited by wrapping them
 with `repo.audit(...)`; not wired up yet.

### Migration notes

- `zod` peer dependency bumped from `^3.23.8` to `^3.25.0` to satisfy
 `@modelcontextprotocol/sdk`. No behavioural change for our schemas.
- `@modelcontextprotocol/sdk` added as a runtime `dependencies` entry
 (not `devDependencies`) because the published CLI exposes the server
 via `npx llmx mcp`.
- `vitest.config.ts` `include` extended to `tests/**/*.test.ts` to
 pick up the new test location.

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
