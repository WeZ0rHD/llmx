# AGENTS.md — LLMX

> **One memory. Every agent.**
> Open context layer for AI coding agents. Local-first, append-only, agent-agnostic.

This file is read by every AI coding agent that enters this repository (Codex, Claude Code, Cursor, Aider, Windsurf, etc.). It defines the project, the contracts, and the rules of the road.

---

## What is LLMX

LLMX is a CLI + format that lets any AI coding agent (Claude Code, Codex, Cursor, Aider…) share a single canonical memory of a project: decisions, tasks, sessions, skills, audit log. Each agent reads/writes through `llmx` commands or the MCP server; LLMX re-renders the agent-native files (`CLAUDE.md`, `AGENTS.md`, etc.) from one source of truth.

- **Spec**: [`specs/llmx-v0.1.md`](specs/llmx-v0.1.md)
- **Vision**: [`docs/vision.md`](docs/vision.md) — v0.1 scope (coding agents)
- **Strategic vision v2**: [`docs/strategic-vision-v2.md`](docs/strategic-vision-v2.md) — the UCP / universal context horizon
- **Roadmap**: [`docs/roadmap.md`](docs/roadmap.md) — two parallel tracks
- **Security**: [`docs/security.md`](docs/security.md)
- **RFCs**: [`specs/rfcs/`](specs/rfcs/) — protocol design decisions

## Repository layout

```
llmx/
├── src/
│   ├── core/           # Repository, Zod schemas, audit, defaults  (no I/O outside Repository)
│   ├── cli/            # Commander.js commands (the only entry that touches stdio)
│   ├── adapters/       # Per-agent re-renderers (claude-code, codex)
│   └── mcp/            # MCP stdio server (planned v0.2)
├── tests/              # Vitest suites
├── examples/           # Real demo projects that exercise every command
├── specs/              # Versioned format/CLI specs (canonical)
├── docs/               # Vision, roadmap, security, architecture
└── .harness/           # The agentic system that builds LLMX (this file's owner)
```

## Golden rules

1. **The Repository is the only thing that touches disk.** Every read, write, atomic rename, JSONL append goes through `src/core/repository.ts`. CLI commands and adapters call Repository methods, never `fs.*` directly.
2. **Schemas are the source of truth.** Public types are derived from Zod via `z.output<typeof X>`. After `.parse()`, cast to the typed shape (`as Type`) for TS stability.
3. **Append-only for events.** `decisions`, `sessions/history`, `audit` are JSONL. Replayable, diff-friendly, mergable.
4. **Atomic writes for snapshots.** JSON files write to `.tmp` then `rename`. No half-written state.
5. **Redaction lives in the audit log only.** No silent scrubbing of decisions or sessions.
6. **No silent PII.** If you read a file the user didn't ask for, you don't paste its contents back.
7. **No new top-level deps without an RFC.** Adding `lodash`, `axios`, etc. is a design decision, not a convenience.
8. **Tests for every new public method.** Vitest, colocated, run via `npm test`.
9. **Conventional commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Scope when relevant (`feat(cli):`).

## Build, test, lint

```bash
npm install            # one-time
npm run build          # tsc → dist/
npm test               # vitest run (must be green before any commit)
npm run lint           # tsc --noEmit (type-check only)
npm run dev            # tsc --watch (for live iteration)
```

## Working on a task

1. Read the spec for the version you're targeting (`specs/llmx-v0.1.md` for now).
2. Read `src/core/repository.ts` to understand the current disk contract.
3. Make the change. Add or update tests. Run `npm test` and `npm run lint`.
4. Commit with a conventional message. Reference the issue or plan file when relevant.
5. If your change touches a public CLI command, update the spec.

## Agent harness

The `.harness/` directory contains the agentic system that builds LLMX. If you are an agent operating under that harness, read `.harness/reins/<your-role>/AGENTS.md` for your scope, inputs, and outputs.

If you are a plain coding agent (no harness), ignore `.harness/` and follow this file's rules.

## License

MIT — see [LICENSE](LICENSE). The cloud sync server (planned v0.3) will ship under a separate commercial license; the format, CLI, and adapters stay MIT.
