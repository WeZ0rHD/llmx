# LLMX — Strategic Vision v2: The HTTP of Agent Contexts

> **One memory. Every agent. Every chat. Every surface.**

This document extends the v0.1 vision (see `docs/vision.md`) without replacing it.
v0.1 stays the v1.0 milestone; this is the **v2.0 horizon** that informs what we
build in v0.2 and v0.3 to make v2.0 cheap to reach.

---

## TL;DR

LLMX is not just a coding-agent memory tool. It's an attempt to become **the open
portability protocol for any context an AI touches** — code projects, chat
conversations on ChatGPT/Claude.ai/Mistral/Le Chat/Grok, browser sessions,
support tickets, you name it. The format we ship today is the **HTTP layer** of
that future; the rest is **ports** and **ingest**.

---

## Why expand the scope

The original problem — "switching from Claude Code to Codex costs me 30 minutes
of re-explaining my project" — is real, but it's a **symptom** of a bigger one:

> **AI context is trapped in the surface where it was created.**

Every time you chat with ChatGPT, ask Claude.ai a question, or use Perplexity,
you produce high-signal context that's stuck inside that product's walled
garden. Switch tools → lose history. Change job → can't take your prompts with
you. Hit a model's context limit → start from zero on the same thread.

LLMX's insight: **the format is the same whether the agent is coding, chatting,
or browsing.** A decision, a task, a session, a skill, a message — these are all
the same primitives at different scopes.

---

## The two-track strategy (parallel, not sequential)

### Track 1 — Revenue track: coding agents (v0.1 → v1.0)

- **Who**: developers using Claude Code, Codex, Cursor, Aider, Windsurf.
- **Pain**: context loss when switching agents.
- **Product**: local `.llmx/` directory + CLI + MCP server + adapters.
- **Revenue path**: cloud sync ($8/mo Pro, $15/user/mo Team).
- **Why now**: this is shipping, this is where the format gets battle-tested,
  this is what funds the rest.

### Track 2 — Vision track: universal context protocol (v2.0)

- **Who**: anyone using 2+ AI surfaces (chat + IDE is the universal combo).
- **Pain**: fragmented AI history across products, lock-in, no ownership.
- **Product**: LLMX as an open standard + ingest layer (browser extension +
  API ingestion) that pumps every AI surface into the user's canonical store.
- **Revenue path**: sync & search SaaS on top of the user's aggregated stream.
- **Why now**: the format needs to be **designed** for non-coding contexts
  *now*, even if we don't ship the ingest layer until v2.0. Otherwise we
  re-do the schema in 18 months.

**The tracks are coupled**: every Track 1 user is a potential Track 2 user,
and every Track 2 design constraint (a `Message` is a `Message` whether it came
from Codex or Claude.ai) makes Track 1's format more defensible.

---

## The protocol, in one paragraph

A **port** in LLMX terminology is an adapter that converts a foreign AI surface
into the canonical LLMX schema. We ship reference ports for Claude Code, Codex,
ChatGPT, Claude.ai, Mistral Le Chat, and Grok. The schema is `Conversation` →
`Message[]` → `Tool[]` → `Attachment[]` → `Citation[]`, with provenance metadata
(`source`, `exported_at`, `original_id`). The SDK is a single function:
`port.export(session) → LLMXBundle`. Anyone can write a port; ports are
versioned, signed, and live in a public registry.

In HTTP terms:

| HTTP | LLMX |
| --- | --- |
| Request/Response | Conversation |
| Header | `LLMX-Provenance` |
| Status code | `LLMX-Sync-State` |
| Content-Type | `LLMX-Schema-Version` |
| TLS | (out of scope; format is plain JSON+JSONL) |

We are not building a transport. We are building a **content format** that any
transport (file, git, IPFS, MCP, HTTP) can carry.

---

## Why this is a 3-5 year play, not 3-5 days

Track 1 ships in days because the schema is small and the surface area is local.
Track 2 needs:

- **Browser extension infra** (Chrome Web Store review, Firefox AMO, signed
  builds, auto-update).
- **Per-site reverse engineering** (DOM scrapers that break weekly).
- **Auth flows** for sites that require login (OAuth, cookie capture).
- **Compliance** (GDPR data export, right-to-delete, terms-of-service
  alignment with each platform).
- **A community** of port authors and a registry to discover them.
- **Capital** to pay for the maintenance burden of N port adapters.

We will **not** build Track 2 in parallel with Track 1. We will:

1. **Now (v0.2)**: ship the format extensions that make Track 2 cheap later
   (generic `Conversation` / `Message` types in the Zod schema, even if
   nothing writes to them yet).
2. **v1.0**: stabilize the spec as v1.0 with a real schema for non-coding
   contexts, ship a Python reference SDK to widen the contributor base.
3. **v2.0 (12-24 months)**: ship the first ingest layer (browser extension
   for ChatGPT + Claude.ai + one more), funded by Track 1 cloud revenue.

This way we never write the same schema twice.

---

## What this means for decisions made in v0.2

When we build the MCP server, the schema adapter, the sync engine, and the
spec, we design for the **broader** schema from day one, even if the v0.2
release only writes the coding subset. Concretely:

- A `Conversation` schema in Zod exists alongside `ProjectState`, not nested
  under it.
- The audit log accepts an `entity_type` discriminator (`project` | `chat`).
- The CLI has a placeholder `llmx chat import <file>` command that errors with
  "not implemented" — but the parser exists.
- The README mentions Track 2 in one paragraph, so contributors know there's
  a bigger story.

**Cost of doing this in v0.2**: a few extra Zod schemas, a discriminated
union, a "not implemented" command. Maybe 4-6 extra hours of work.
**Cost of retrofitting this in v1.5**: a breaking schema change, a migration
script, a v1→v1.5 compat layer, contributor goodwill burnt. **Don't do it.**

---

## What we are NOT doing (v2.0 scope guardrails)

To keep Track 1 from being eaten by Track 2:

- **No browser extension in v0.2 or v0.3.** That's a v2.0 problem with v2.0
  infra (signed builds, store listings, update channels).
- **No scraping of paid-only sources** (Grok Premium, ChatGPT Plus-only
  features) until we have legal review and a partnership lane.
- **No "social" features** (sharing chats publicly, leaderboards, etc.). LLMX
  is a personal data layer, not a social network.
- **No model inference.** LLMX is a storage and transport format. It does not
  call any LLM. Ever.

---

## Success metrics for v2.0 (3-year horizon)

- **Adoption**: 100k MAU ingesting from at least 2 surfaces each.
- **Ecosystem**: 20+ community-contributed ports in the public registry.
- **Format stability**: 18 months between breaking schema changes.
- **Revenue**: $2M ARR, with ≥60% from non-coding surfaces (proof that Track 2
  has its own pull, not just an upsell from Track 1).
- **Standardization**: one or more agents / IDEs ship native LLMX support
  (read-only is fine; that's how HTTP won — browsers adopted it incrementally).

---

## The north star, in one sentence

> **LLMX should be the format you reach for when you want your AI context to
> outlive the product that created it.**

If a decision moves us closer to that, ship it. If it doesn't, defer it.
