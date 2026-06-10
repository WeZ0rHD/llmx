# Plan: add-llmx-doctor

> **Status**: in-progress
> **Owner**: Mavis
> **Created**: 2026-06-10
> **Target version**: v0.2.0
> **Reins involved**: arch, build, verify

## Goal

Add a `llmx doctor` command that runs a battery of self-checks on a `project.llmx/` directory and reports OK/WARN/ERROR per check, exit code = max severity.

## Why now

First end-to-end test of the agentic system (`.harness/`). Small enough to ship in one cycle, big enough to exercise every rein.

## Scope

### In

- New command `llmx doctor` with flag `--dir <path>` (default `.`)
- Checks: `project.llmx/` exists, `manifest.json` valid, `decisions.jsonl` valid JSONL, `tasks.jsonl` valid, `sessions/history.jsonl` valid, no orphan files, all referenced IDs resolve
- Output: human-readable by default, `--json` for machine
- Exit codes: 0 = OK, 1 = WARN, 2 = ERROR
- Colocated tests in `src/cli/doctor.test.ts` (or wherever the command lives)
- Spec update in `specs/llmx-v0.1.md` (new section)
- README update with one example

### Out

- Auto-fix (just report; v0.3 if needed)
- Network/cloud checks (local only)
- Performance benchmarks

## Definition of done

- [ ] `llmx doctor` runs in `examples/demo-project/` and reports all OK
- [ ] `llmx doctor` on a broken fixture reports the right errors
- [ ] `--json` output matches a snapshot test
- [ ] `npm test` green (new tests + existing 19/19)
- [ ] `npm run lint` clean
- [ ] Spec updated
- [ ] README has a one-liner example
- [ ] Verify rein emits PASS

## Steps

1. **arch** — RFC at `.harness/team-plans/rfcs/doctor.md` (one-screen: checks list, output format, exit codes)
2. **build** — implement `src/cli/doctor.ts`, wire into `src/cli/program.ts`, add tests
3. **verify** — emit verdict at `.harness/team-plans/verdicts/add-llmx-doctor-1.md`
4. (loop on FAIL — at most 2 rounds expected)
5. **Mavis** — show the human, get sign-off, commit

## Risks

- **Path traversal in `--dir`** → verify will FAIL any implementation that doesn't resolve to an absolute path and reject `..`
- **JSONL parsing performance on large files** → use streaming readline, not `readFileSync` on a 100MB file

## Cost estimate

- API tokens: ~$2
- Time: ~1h wall-clock
- Infra: $0

## Notes

- This is also the *test of the system itself*. If this plan ships, the `.harness/` is validated end-to-end.
