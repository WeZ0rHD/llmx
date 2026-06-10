# RFC: `llmx doctor`

> **Status**: approved
> **Author**: arch rein
> **Date**: 2026-06-10
> **Plan**: [add-llmx-doctor](../examples/add-llmx-doctor.md)

## Problem

Users have a `project.llmx/` directory but no built-in way to know if it's healthy. Silent corruption (truncated JSONL, missing manifest, orphan files) breaks adapters and the cloud sync. We need a one-command self-check.

## Options considered

### Option A — New top-level command `llmx doctor` ✅ recommended

- `llmx doctor [--dir <path>] [--json]`
- Runs 6 checks, prints colored human output or `--json`
- Exit codes: 0/1/2 mapped to OK/WARN/ERROR

Pros: discoverable (`llmx --help` shows it), simple, mirrors `git fsck` / `npm doctor`.
Cons: +1 CLI surface to maintain.

### Option B — Subcommand of `status`

- `llmx status --doctor`

Pros: one less top-level command.
Cons: conflates "show current state" with "diagnose health", harder to grep for in scripts.

### Option C — Auto-run on every command

Pros: zero friction.
Cons: hidden cost on every invocation, can't be disabled cleanly, surprising for CI.

## Recommendation

**Option A.** Discoverable, scriptable, mirrors familiar dev-tool conventions.

## Checks (v0)

1. **`project.llmx/` exists** — ERROR if not
2. **`manifest.json` is valid JSON** + matches `ManifestSchema` — ERROR if not
3. **`decisions.jsonl` is valid JSONL** (one valid record per line) — ERROR on first bad line
4. **`tasks.jsonl` is valid JSONL** + IDs unique + `dependencies` resolve — WARN/ERROR
5. **`sessions/history.jsonl` is valid JSONL** + `taskId` refs resolve — WARN/ERROR
6. **No orphan files** in `project.llmx/` (everything tracked in `manifest.json`) — WARN

## Output format

Human (default):
```
LLMX doctor — /Users/me/myapp

✓ project.llmx/ exists
✓ manifest.json valid (12 keys, schema v0.1)
✓ decisions.jsonl: 7 records, 0 invalid
⚠ tasks.jsonl: 3 records, 1 invalid (line 4)
✓ sessions/history.jsonl: 5 records, 0 invalid
✓ no orphan files

Result: WARN (1 issue)
```

JSON (`--json`):
```json
{
  "dir": "/Users/me/myapp",
  "checks": [
    {"name": "manifest-exists", "status": "ok", "detail": "..."},
    {"name": "decisions-valid", "status": "ok", "stats": {"records": 7, "invalid": 0}}
  ],
  "result": "warn"
}
```

## Exit codes

- `0` — all OK
- `1` — at least one WARN, no ERROR
- `2` — at least one ERROR

## Implementation sketch

- New file `src/cli/doctor.ts` (Commander subcommand, mirrors `status.ts`)
- Pure check functions in `src/core/checks.ts`, each returns `{name, status, detail, stats?}`
- `doctor` command runs them in order, aggregates, prints, exits
- Tests: `src/cli/doctor.test.ts` with a fixture `project.llmx/` (good + 2 broken variants)

## Open questions

- Should we also check `audit.jsonl`? **Yes, add as check 7.** It's the highest-value integrity signal.
- Should we offer `--fix`? **No, v0 is read-only.**
