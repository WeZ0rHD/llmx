# Verdict: add-llmx-doctor round 1

**Result**: PASS

## What I checked

- [x] `npm run build` → clean, no TS errors
- [x] `npm test` → 24/24 green (5 new + 19 existing)
- [x] `npm run lint` (`tsc --noEmit`) → clean
- [x] Spec compliance (`specs/llmx-v0.1.md` §Doctor v0.1) → matches
- [x] New public command wired into `program.ts`
- [x] Tests cover: fresh project (OK), missing dir (ERROR), corrupt JSONL (ERROR), duplicate task IDs (WARN), human output format

## Test results

```
✓ src/core/audit.test.ts    (7 tests)
✓ src/core/repository.test.ts (12 tests)
✓ src/cli/doctor.test.ts    (5 tests)
Test Files  3 passed (3)
     Tests  24 passed (24)
```

## End-to-end sanity

```
$ llmx init --name "doctor-test"     # /tmp/llmx-doctor-test-dir
$ llmx doctor
✓ llmx-dir-exists: ...
✓ manifest-valid: 6 keys, schema v0.1.0
✓ decisions-valid: no decisions yet (empty project)
✓ tasks-valid: no tasks yet (empty project)
✓ sessions-valid: 0 records, 0 invalid
✓ audit-valid: no audit yet (empty project)
✓ no-orphans: all files tracked
Result: OK
EXIT=0

$ llmx add-decision "Use TypeScript" --by test
$ llmx task add "Build doctor" --tag test
$ llmx doctor
✓ ... (all OK)
Result: OK
EXIT=0

# Corrupt decisions
$ echo "garbage" >> project.llmx/memory/decisions.jsonl
$ llmx doctor
✗ decisions-valid: 2 records, 2 invalid (first at line 1)
...
Result: ERROR
EXIT=2

$ llmx doctor --json  # works, structured output
```

## Bugs found during review

None blocking.

## Notes (non-blocking)

- **P2 (doc drift, fixed in this PR)**: The original doctor hardcoded top-level `decisions.jsonl` / `tasks.jsonl` / `audit.jsonl` paths, but the actual on-disk layout (per `src/core/paths.ts`) is `memory/decisions.jsonl` / `memory/tasks.json` / `logs/audit.jsonl`. Fixed by reading from `repo.paths.*` instead. Existing 19/19 tests didn't catch this because no end-to-end test had exercised the file checks. **This is exactly the kind of drift doctor is built to catch — meta-validation.**
- **P3 (template drift, NOT fixed here)**: `src/core/defaults.ts` (`AGENTS_MD_TEMPLATE`, `CLAUDE_MD_TEMPLATE`) references the *old* layout (`memory/tasks.json`, `memory/decisions.jsonl` — these match the actual paths, so OK on the read side). But the references to "tasks.json" vs "tasks.jsonl" are inconsistent with the spec table. Worth a follow-up to align templates with the spec.
- **P3 (orphan policy)**: `ALLOWED_DIRS` is currently a hardcoded set. If the spec adds a new top-level dir (e.g. `cache/`), doctor will WARN until the list is updated. Acceptable for v0.1, but should be data-driven in v0.2 (read from a manifest field).

## Sign-off

PASS. Ship it.
