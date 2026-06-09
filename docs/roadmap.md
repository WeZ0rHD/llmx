# LLMX — Roadmap

## v0.1 — local-first MVP (current)

Goal: prove the Claude Code ↔ Codex handoff.

- [x] `llmx init` / `llmx status`
- [x] `llmx add-decision` / `llmx task add|update` / `llmx session save`
- [x] `llmx export claude` / `llmx export codex`
- [x] Atomic writes, JSONL append-only for decisions/sessions/audit
- [x] Audit log + secret redaction
- [x] Vitest tests on the core
- [x] Spec v0.1
- [x] Demo project

## v0.2 — MCP + sync

- [ ] `llmx mcp start` (stdio MCP server with the tools/resources list)
- [ ] `llmx sync --watch` (chokidar-based watch + audit)
- [ ] Interop test: spin up MCP server, connect a fake MCP client,
      round-trip a decision
- [ ] `llmx skill create|list|show` polished

## v0.3 — multi-project and portability

- [ ] `llmx bundle` / `llmx import` — pack/unpack a `.llmx` archive
- [ ] Optional git-remote sync helper (`llmx sync --remote <url>`)
- [ ] Cursor adapter
- [ ] Project-level `llmx doctor` — sanity-check the directory

## v1.0 — open standard

- [ ] Spec moved to `specs/llmx-v1.0.md` with a stable schema
- [ ] Reference implementations in TS + Python
- [ ] Compatibility tests against Claude Code, Codex, and one third agent
- [ ] Public registry of canonical skill names
