# Plan: <name>

> **Status**: draft | in-progress | done | cancelled
> **Owner**: Mavis
> **Created**: YYYY-MM-DD
> **Target version**: v0.x.y
> **Reins involved**: arch, build, verify, [others]

## Goal

One sentence. What does "done" look like from the user's perspective?

## Why now

2-3 sentences. What's the trigger (user request, roadmap item, blocker)?

## Scope

### In

- Bullet list of what's included

### Out

- Bullet list of what's explicitly NOT included (defends against scope creep)

## Definition of done

- [ ] Specific, testable outcome 1
- [ ] Specific, testable outcome 2
- [ ] Verify rein has emitted a PASS verdict
- [ ] Docs updated (README, CHANGELOG, relevant docs/)
- [ ] Human has approved the final result

## Steps

1. **arch** (if needed) — produce RFC at `.harness/team-plans/rfcs/<name>.md`
2. **build** — implement per RFC
3. **verify** — emit verdict at `.harness/team-plans/verdicts/<name>-1.md`
4. (loop on FAIL)
5. **ship** — tag, publish, changelog
6. **content** — draft launch post
7. **growth** — schedule the announcement
8. **Mavis** — show the human, get final approval

## Risks

- Risk 1 → mitigation
- Risk 2 → mitigation

## Cost estimate

- API tokens: ~$X
- Time: ~Xh wall-clock
- Infra: $X/mo recurring (if any)

## Notes

- Free-form scratch space for Mavis
