# LLMX v0.3 — Studio Spec (DRAFT)

> **Status: draft, awaiting owner review. Not yet a v0.3 commitment.**

> **Your AI memory, turned into content.**

A local-first app on top of LLMX Core (v0.1/v0.2 already shipped) that
captures your ideas + project activity and turns them into drafts you
can publish anywhere.

> **Builds on:** LLMX v0.1 format + v0.2 MCP server (both shipped).
> **Extends:** `~/.llmx/studio/` (new personal directory) layered on
> top of the existing `project.llmx/` (per-project directory).

## Goal

A solo dev/founder using 3+ AI tools a day should be able to:

1. **Capture** any idea (text, voice note, screenshot, URL, git commit)
   in <10 seconds
2. **Get a synthesis** of what they've been thinking/working on this
   week, on demand
3. **Generate a draft** (X thread, LinkedIn post, blog article) from
   any captured idea or project event in <30 seconds
4. **Review and publish** — no auto-publish, no surprises

## Non-goals (v0.3)

- No auto-publish to any platform. Drafts only. Always human-in-the-loop.
- No team mode. Solo user only.
- No cloud sync. Local-first, single machine.
- No browser extension (capture is via CLI + share-sheet / drag-drop).
- No embeddings / vector search. Keyword + date + tag filters only.
- No mobile app. CLI + desktop app only.
- No social features. No leaderboards, no public profiles.

## The 3 user stories

**Story 1 — Capture an idea**
> Romain is in the metro, has an idea about pricing. He opens the
> LLMX Studio desktop app, taps the capture button, speaks 30 seconds.
> LLMX transcribes, tags it (`pricing`, `idea`, `urgent`), and shows
> it in his inbox.

**Story 2 — Get the weekly synthesis**
> Every Monday at 9am, LLMX emails (or shows in-app) a 1-page synthesis:
> "Last week you made 4 decisions, started 3 tasks, captured 12 ideas.
> Top themes: pricing, onboarding, dev tools. Suggested draft angles:
> X thread on your pricing experiment."

**Story 3 — Generate a draft from project activity**
> Romain just shipped v0.2 (3 commits, 2 new features, 1 decision).
> He opens LLMX Studio, picks "Build in public" mode, picks the v0.2
> release. LLMX generates 3 drafts:
> - X thread (5 tweets) on what shipped
> - LinkedIn post on the architecture decision
> - Blog post intro on the local-first principle
> He edits, approves, copy-pastes to his scheduling tool.

## On-disk format (extends `.llmx/`)

The existing `project.llmx/` stays as the project context store. We add
a **new** `studio.llmx/` at the user home (not the project root) for
personal content:

```
~/.llmx/studio/
├── manifest.json
├── inbox/                       # raw captures
│   ├── 2026-06-11_idea-pricing.md
│   ├── 2026-06-11_voice-metro.m4a + transcript.md
│   └── 2026-06-11_url-article-xyz.md
├── classified/                  # agent-tagged entries
│   └── by-tag/pricing/...
├── syntheses/                   # weekly/monthly digests
│   └── 2026-W24.md
├── drafts/                      # generated content
│   ├── x-thread-pricing-v1.md
│   ├── linkedin-architecture-v1.md
│   └── blog-local-first-v1.md
├── published/                   # archive of what shipped (manual paste)
│   └── 2026-06-12_x-thread-pricing.md
└── logs/audit.jsonl
```

**No new schemas.** We reuse the existing `manifest.json`, `decisions.jsonl`,
`tasks.json`, and `audit.jsonl` formats from LLMX v0.1. The new bits
(`inbox/`, `classified/`, `syntheses/`, `drafts/`) are markdown
directories, no schema enforcement beyond a filename convention.

## Components

| Component | Purpose | Reuses from LLMX v0.1/v0.2 |
|---|---|---|
| `llmx studio capture` (CLI) | Quick capture from terminal / share-sheet | `core/Repository.appendEvent` |
| `llmx studio classify` (CLI) | Batch-classify inbox entries by tag/theme | New: simple LLM call, no schema |
| `llmx studio synthesize` (CLI) | Generate weekly/monthly digest | New: LLM call, writes to `syntheses/` |
| `llmx studio draft` (CLI) | Generate a draft (x / linkedin / blog) from an inbox entry OR a project event | New: LLM call, writes to `drafts/` |
| `llmx studio inbox` (CLI) | List + filter inbox | Reads from `inbox/` |
| Desktop app (Tauri) | Visual UI: inbox view, capture button, draft editor | Wraps the CLI |
| MCP server (existing) | Exposes project context to AI agents | Already shipped in v0.2 |

## CLI surface (V1)

```bash
# Capture
llmx studio capture "Pricing should be usage-based, not seat-based"
llmx studio capture --from-file ./notes.md
llmx studio capture --from-url https://...
llmx studio capture --from-stdin   # pipe from share-sheet

# Classify (run nightly, or on demand)
llmx studio classify                # tag all unclassified inbox entries
llmx studio classify --tag pricing  # re-tag with hint

# Synthesize
llmx studio synthesize              # generate current week digest
llmx studio synthesize --month      # generate monthly digest

# Draft
llmx studio draft x-thread --from inbox/2026-06-11_idea-pricing.md
llmx studio draft linkedin --from-decision "Use PostgreSQL"
llmx studio draft blog --from-synthesis syntheses/2026-W24.md
llmx studio draft blog --from-release v0.2.0   # auto-pulls from git log

# List / view
llmx studio inbox                   # show last 20
llmx studio inbox --tag pricing
llmx studio drafts                  # show all drafts
llmx studio syntheses               # show all digests
```

## LLM calls (the only intelligence in the app)

All LLM calls are local first (Ollama), cloud fallback (Claude API /
OpenAI) with explicit user choice. **No calls happen silently.**

1. **Classify** — given an inbox entry, return `{ tags: string[],
   urgency: 'low'|'med'|'high', project?: string }`
2. **Synthesize** — given last 7 days of `classified/`, return a
   markdown digest with sections: themes, decisions, open questions,
   suggested angles
3. **Draft** — given a source (inbox entry / decision / release), return
   markdown draft in the target format (x-thread / linkedin / blog)

**Temperature:** 0.7 for drafts, 0.3 for classify/synthesize.
**Max tokens:** 2000 for drafts, 800 for classify, 1500 for synthesize.
**No function calls, no agents, no RAG.** Single-turn LLM with the
source as context. Period.

## Storage & privacy

- Everything lives under `~/.llmx/studio/` — plain markdown + JSONL
- No network calls except the LLM (user-configured endpoint)
- API keys stored in OS keychain, not in `.llmx/`
- Audit log of every LLM call (what was sent, what came back, model used)
- `llmx studio export` produces a tarball of `studio.llmx/` for backup
- `llmx studio import` restores from tarball
- **Zero telemetry, zero analytics, zero phone-home**

## Success criteria (V1)

A user can, in one sitting of <30 minutes:

1. Capture 3 ideas (text + voice + URL)
2. Run `classify` and see them auto-tagged
3. Run `synthesize` and read a sensible weekly digest
4. Generate 2 drafts (X + LinkedIn) from the captured material
5. Edit both drafts, copy them out, "publish" by moving to `published/`

**If this loop is not delightful, V1 is not done.**

## Success criteria (adoption)

After 30 days of dogfooding with 20 solo devs:

- ≥50% of test users open the app at least 1×/week
- ≥30% generate at least 1 draft/week
- ≥20% publish at least 1 draft (manual paste counts)
- NPS ≥40

If we miss these, V2 pivots or we stop. No more.

## What V2 adds (NOT in V1)

- Cloud sync (paid, $8/mo)
- Team workspace (paid, $15/user/mo)
- Auto-publish (after the model learns the user's voice, 3-6 months)
- Browser extension (capture from any page)
- Mobile app
- Vector search (RAG over the full inbox)
- Tana-style graph view

## What we are NOT building (ever)

- Native session capture from ChatGPT/Claude/Codex (illegal, fragile,
  breaks weekly)
- Hidden reasoning capture
- Social features
- Marketplace of skills/templates
- A "second brain for everyone" marketing pitch

## Anti-features (the things we will be tempted to add but must not)

- **AI agent that does things for you.** LLMX Studio is a memory + draft
  tool, not an agent platform.
- **Real-time suggestions while you work.** Distracting. Batch is fine.
- **Beautiful graph visualisations.** Most users won't look at them
  after the first 5 minutes.
- **Multi-modal output** (image / video generation). Out of scope.
- **Browser-side intelligence.** Privacy + legal minefield.

---

## Open questions — RESOLVED (2026-06-11)

1. **Local LLM first, cloud fallback, or cloud only?**
   → **Local first (Ollama), cloud opt-in (Claude/OpenAI).** Best
   privacy story, lowest cost for solo users, no surprise bills.
   `llmx studio config llm` switches the provider.

2. **Voice transcription** — local (whisper.cpp) or cloud (Whisper API)?
   → **Local first (whisper.cpp), cloud opt-in.** Same reasoning: cost,
   privacy, offline-first.

3. **Capture on mobile** — iOS Shortcut + iCloud Drive, or wait for a
   real mobile app?
   → **iOS Shortcut → writes to iCloud Drive → `studio/inbox/`.** No
   app, no App Store, no review delays. Cost: 1 day to build the
   shortcut and document it. The shortcut URL is a one-liner in the
   README.

4. **Pricing** — free forever for local, or freemium with sync limit?
   → **Free forever for local. Sync is the only paid thing ($8/mo
   V2).** Solo local users never pay. The product is open-core: the
   studio CLI + desktop app are MIT, the cloud sync engine (V2) is
   proprietary.

---

> **One-line pitch:**
> LLMX Studio = your AI memory + your project activity, turned into
> content drafts you actually want to publish.
