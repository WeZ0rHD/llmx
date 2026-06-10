# RFC 0001: Universal Context Protocol (UCP)

| Field | Value |
| --- | --- |
| **Status** | Draft (pre-merge) |
| **Author** | Architecture rein |
| **Created** | 2026-06-10 |
| **Target spec** | `specs/llmx-v1.0.md` (extends v0.1) |
| **Supersedes** | — |
| **Related** | `docs/strategic-vision-v2.md` |

## Summary

This RFC proposes the **Universal Context Protocol (UCP)**: a layered extension
to the LLMX v0.1 schema that lets the same canonical store represent both
**project-level coding context** (decisions, tasks, skills, sessions) and
**user-level conversational context** (chats from ChatGPT, Claude.ai, Mistral
Le Chat, etc.).

The goal is to make the v1.0 schema **the last breaking change** LLMX ever
ships: from v1.0 forward, new context types add new schemas inside the same
bundle, they do not fork the bundle.

## Motivation

The v0.1 schema was designed for one agent (a coding agent) inside one project.
Three constraints make it unfit for the v2.0 vision:

1. **No top-level `Conversation` primitive.** v0.1 has `Session` (a coding
   session) but not `Conversation` (a chat thread). Forcing chat threads into
   `Session` conflates "agent work in a project" with "user chat across
   surfaces".
2. **No `Message` primitive.** v0.1 stores session outputs as opaque text. To
   ingest a Claude.ai chat we need structured `Message` (role, content blocks,
   tool calls, citations, attachments).
3. **No provenance metadata.** v0.1 entries are authored by the local user.
   Ingested entries need `source`, `original_id`, `exported_at`, and a chain
   of custody to be trustworthy.

We do not need to **ship** chat ingest in v0.2 or v0.3. We do need to **reserve
the namespace** in v0.2 so v1.0 is a non-breaking extension, not a rewrite.

## Design

### Layered schema

```
LLMXBundle (root)
├── project          ProjectState           (existing, unchanged)
├── conversations    Conversation[]         (new, optional)
│   └── messages     Message[]              (new, optional)
│       ├── content_blocks  ContentBlock[]   (new)
│       ├── tool_calls      ToolCall[]       (new)
│       ├── citations       Citation[]       (new)
│       └── attachments     Attachment[]     (new)
├── skills           Skill[]                (existing, unchanged)
├── audit            AuditEntry[]           (existing, + entity_type)
└── meta             BundleMeta             (new, required for v1.0)
```

All new top-level keys are **optional** in v0.2 (forward-compatible). In v1.0
they are still optional (some users will only ever ship project state). The
schema is **additive, never subtractive**, from v0.2 onward.

### New primitives (Zod, v0.2 +)

```ts
// A bundle is the unit of portability — a file, a git tree, an MCP payload.
const BundleMeta = z.object({
  schema_version: z.literal('1.0'),
  llx_version: z.string(),              // e.g. "0.2.0"
  created_at: z.string().datetime(),
  bundle_id: z.string().uuid(),
  // Chain of custody: who/what produced this bundle, in what order.
  provenance: z.array(ProvenanceStep),
});

const ProvenanceStep = z.object({
  actor: z.enum(['user', 'agent:claude-code', 'agent:codex',
                 'port:chatgpt', 'port:claude-ai', 'port:mistral',
                 'port:grok', 'llmx-cli']),
  action: z.enum(['created', 'appended', 'merged', 'redacted',
                  'exported', 'imported']),
  at: z.string().datetime(),
  // Optional cryptographic reference, e.g. a git commit SHA or content hash.
  ref: z.string().optional(),
});

const Conversation = z.object({
  id: z.string().uuid(),
  title: z.string(),
  source: ConversationSource,           // which surface produced this
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  messages: z.array(Message).min(1),
  // Free-form tags set by the port or the user.
  tags: z.array(z.string()).default([]),
});

const ConversationSource = z.object({
  surface: z.enum(['chatgpt', 'claude-ai', 'mistral-le-chat',
                    'grok', 'perplexity', 'poe', 'manual',
                    'unknown']),
  surface_id: z.string(),               // original ID on that surface
  surface_url: z.string().url().optional(),
  export_method: z.enum(['api', 'dom', 'manual-export',
                           'browser-extension', 'unknown']),
  exported_at: z.string().datetime(),
  port_version: z.string(),             // which port adapter produced this
});

const Message = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  author: z.string().optional(),        // e.g. "gpt-4o", "claude-opus-4"
  created_at: z.string().datetime(),
  content_blocks: z.array(ContentBlock).min(1),
  tool_calls: z.array(ToolCall).default([]),
  citations: z.array(Citation).default([]),
  attachments: z.array(Attachment).default([]),
  // If a port redacts or summarizes on import, the original is preserved.
  redaction_note: z.string().optional(),
});

const ContentBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('thinking'), text: z.string() }),
  z.object({ kind: z.literal('code'),
             language: z.string(), code: z.string() }),
  z.object({ kind: z.literal('image'),
             src: z.string(),           // local path or https URL
             alt: z.string().optional() }),
  z.object({ kind: z.literal('refusal'), text: z.string() }),
]);

const ToolCall = z.object({
  id: z.string(),
  name: z.string(),                      // e.g. "web_search", "code_exec"
  arguments: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['ok', 'error', 'cancelled', 'pending']),
});

const Citation = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  cited_at: z.string().datetime().optional(),
});

const Attachment = z.object({
  id: z.string().uuid(),
  kind: z.enum(['file', 'image', 'audio', 'video']),
  name: z.string(),
  mime: z.string(),
  size_bytes: z.number().int().nonnegative(),
  // Inline base64 for small files, content-addressed ref for large.
  storage: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('inline'),
               data_base64: z.string() }),
    z.object({ mode: z.literal('ref'),
               hash: z.string(),         // sha256
               location: z.string() }),  // path or URL
  ]),
});
```

### Audit log extension

The existing `AuditEntry` gets one new optional field:

```ts
entity_type: z.enum(['project', 'conversation', 'message', 'skill',
                     'session', 'unknown']).default('project'),
```

Old audit entries default to `project` and remain valid. New entries from
ports default to `conversation` or `message`.

### Backwards compatibility

- A v0.1 bundle is a valid v0.2 bundle (just with `conversations: []`).
- A v0.2 bundle is a valid v1.0 bundle (`bundle_id` is required in v1.0;
  the v0.2→v1.0 migrator adds it deterministically from `meta.created_at`).
- A v1.0 bundle is **not** a valid v0.1 bundle (because v0.1 doesn't know about
  `conversations`). That's fine — we don't claim forward compat for the
  pre-stable versions.

### Ports

A **port** is a function:

```ts
type Port = (input: PortInput) => Promise<Conversation | Conversation[]>;
```

Ports are pure: they take a foreign export (HTML, JSON, API response) and emit
canonical `Conversation` objects. They do not touch the filesystem. The CLI
`llmx chat import <file> --port <name>` is the glue.

We ship **reference ports** for the major surfaces; the community ships
**third-party ports** in a public registry (`llmx.dev/ports`). Ports are
versioned (`port:chatgpt@1.2.0`) and signed by their author.

### Why JSONL stays

Even with `Conversation[]` in the bundle, we keep JSONL as the **transport**
for append-only streams (audit, decisions, sessions, ingested messages).
A `Conversation` is a **snapshot**; the JSONL is the **event log**. This is
the same model as git (snapshots + refs) and gives us free merge semantics.

## Drawbacks

- **More schema = more code to maintain.** Mitigated: the new primitives are
  inert in v0.2 (no producer, no reader in the CLI). They cost ~200 lines of
  Zod and zero runtime.
- **Confusion between `Session` and `Conversation`.** A `Session` is "agent
  work in a project" (a Codex run, a Claude Code loop). A `Conversation` is
  "user chat across surfaces". They are not the same; a future RFC may merge
  them under a single `Thread` abstraction. For v0.2 / v1.0 we keep both.
- **Privacy surface increases.** A bundle that contains a full ChatGPT
  history is a juicy target. Mitigated: per-message redaction notes,
  per-bundle encryption (out of scope for this RFC, see RFC 0002), and the
  "local-first by default" rule from `docs/vision.md`.

## Alternatives considered

1. **Fork LLMX into "LLMX-Code" and "LLMX-Chat".** Rejected: doubles the
   maintenance, splits the ecosystem, defeats the point of a single canonical
   store.
2. **Use a third-party schema (OpenAI's, Anthropic's, LangChain's).** Rejected:
   they are vendor-coupled, lack provenance, and don't ship a public
   versioning story. We can still **export** to those formats via adapters
   without making them canonical.
3. **Wait until v2.0 to add the schema.** Rejected: the cost of retrofitting
   later (breaking change, migrations, contributor trust) is much higher than
   the cost of adding inert schemas now (~4-6 hours of work).

## Open questions

- Should `Conversation.id` be deterministic from the source (so re-imports
  dedupe) or a fresh UUID (so re-imports are append-only events)? Lean:
  deterministic. The port computes a stable hash from `source.surface_id` and
  `source.exported_at` truncated to the minute.
- Should we add a `Message.parent_id` for branching conversations (Claude.ai
  has branch points)? Yes, but deferred to a follow-up RFC.
- Encryption: do we encrypt bundles at rest by default, or leave that to the
  sync layer? Lean: leave it to the sync layer. Format stays plaintext JSON;
  sync layer does the crypto.

## Adoption plan

1. **v0.2 (now)**: land the new Zod schemas in `src/core/schema/conversation.ts`
   (new file, no behavior change). Add `llmx chat import --port <name>` as a
   stub that errors with "no port registered yet". Document in
   `docs/strategic-vision-v2.md`.
2. **v0.3**: ship the first reference port (`port:chatgpt@0.1.0`) for manual
   JSON exports. CLI can import a real ChatGPT export. Tests round-trip a
   sample conversation.
3. **v1.0**: stabilize the schema, ship a Python reference SDK, publish
   `specs/llmx-v1.0.md`, open the public port registry.
4. **v2.0** (12-24 months out): browser extension ingest layer, full port
   coverage of the top 6 surfaces, sync SaaS live.

## Unresolved questions for the team

- @arch: do we want `bundle_id` to be a UUIDv7 (sortable) or UUIDv4 (random)?
- @build: is there a way to keep the CLI binary size flat despite the new
  schemas? (Probably yes, they're tree-shakeable Zod.)
- @verify: what's the round-trip test strategy for `Conversation` before we
  have any real port? (Faker fixtures, see RFC 0001-addendum-test-strategy.md
  to be drafted.)

---

**Decision requested**: approve this RFC as the v1.0 schema direction, with
the v0.2 inert-schemas land step as the first deliverable.
