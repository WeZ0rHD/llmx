# LLMX — Roadmap

> Two tracks in parallel. Track 1 (coding agents) ships in days and funds the
> rest. Track 2 (universal context protocol) is the v2.0 horizon — we lay
> rails for it now, ship it later. See `docs/internal/horizon-2.0.md` and
> `specs/rfcs/0001-universal-context-protocol.md`.

## v0.1 — local-first MVP (shipped)

Goal: prove the Claude Code ↔ Codex handoff.

- [x] `llmx init` / `llmx status`
- [x] `llmx add-decision` / `llmx task add|update` / `llmx session save`
- [x] `llmx export claude` / `llmx export codex`
- [x] Atomic writes, JSONL append-only for decisions/sessions/audit
- [x] Audit log + secret redaction
- [x] Vitest tests on the core
- [x] Spec v0.1
- [x] Demo project
- [x] `llmx doctor`
- [x] `.harness/` agentic system

## v0.2 — MCP + UCP-rails (current focus)

Goal: usable in Claude Code / Codex in real time + reserve the schema
namespace for non-coding contexts.

**Track 1 — MCP (revenue track)**

- [ ] `llmx mcp start` (stdio MCP server with the tools/resources list)
- [ ] Interop test: spin up MCP server, connect a fake MCP client,
      round-trip a decision
- [ ] `llmx skill create|list|show` polished
- [ ] GitHub push + public repo + launch post

**Track 2 — UCP rails (vision track, inert in this release)**

- [ ] Land `Conversation` / `Message` / `ContentBlock` Zod schemas in
      `src/core/schema/conversation.ts` (no producer, no CLI reader yet)
- [ ] `AuditEntry.entity_type` discriminator added (default `project` for
      backwards compat)
- [ ] `llmx chat import <file> --port <name>` CLI stub that errors with
      "no port registered yet" — but the parser exists
- [ ] `docs/internal/horizon-2.0.md` published
- [ ] `specs/rfcs/0001-universal-context-protocol.md` merged

## v0.3 — multi-project + first reference port

Goal: portable bundles + the first non-coding port (ChatGPT manual export).

- [ ] `llmx bundle` / `llmx import` — pack/unpack a `.llmx` archive
- [ ] `BundleMeta` with `bundle_id` (UUIDv7) — required field, migrate v0.2
      bundles on load
- [ ] Optional git-remote sync helper (`llmx sync --remote <url>`)
- [ ] Cursor adapter
- [ ] Project-level `llmx doctor` — sanity-check the directory
- [ ] `port:chatgpt@0.1.0` — manual JSON import of a ChatGPT data export
- [ ] Round-trip test: import a sample ChatGPT export, re-export, diff
- [ ] Python reference SDK (`llmx-py`) skeleton

## v1.0 — open standard

- [ ] Spec moved to `specs/llmx-v1.0.md` with a stable schema
- [ ] Reference implementations in TS + Python
- [ ] Compatibility tests against Claude Code, Codex, ChatGPT port
- [ ] Public registry of canonical skill names
- [ ] Public port registry (`llmx.dev/ports`) — accepts third-party
      contributions
- [ ] First governance doc (RFC process, port review criteria)

## v2.0 — universal ingest (12-24 months out)

- [ ] Browser extension (Chrome + Firefox) — DOM scrapers for ChatGPT,
      Claude.ai, Mistral Le Chat, Perplexity
- [ ] OAuth / cookie-based auth for sites that gate history behind login
- [ ] Per-platform export-method fallback chain
      (extension → API → manual import)
- [ ] Sync SaaS live (Pro $8/mo, Team $15/user/mo)
- [ ] GDPR / right-to-delete tooling for ingested chats
- [ ] 20+ community-contributed ports in the registry
