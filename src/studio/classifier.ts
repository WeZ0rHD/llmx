/**
 * Studio classifier (V1) — keyword/heuristic tagger.
 *
 * Sprint 1: deterministic, no LLM. Picks tags from a small fixed
 * vocabulary by scanning the text. Confidence is per-tag.
 *
 * Sprint 2: replace the body of `classify()` with an LLM call when
 * `LLMX_STUDIO_LLM=1` is set. The signature and return shape stay
 * the same so the CLI doesn't change.
 */
import type { ClassifiedEntry, Urgency } from './schema.js';

export interface ClassifyResult {
  tags: string[];
  urgency: Urgency;
  project: string | null;
  // Per-tag confidence in [0, 1]. Tags below 0.5 are dropped.
  confidences: Record<string, number>;
}

interface TagRule {
  tag: string;
  patterns: RegExp[];
}

const TAG_RULES: TagRule[] = [
  { tag: 'pricing',    patterns: [/\bpric(e|ing)\b/i, /\bpaywall\b/i, /\bsubscription\b/i] },
  { tag: 'idea',       patterns: [/\bidea\b/i, /\bperhaps\b/i, /\bwe could\b/i, /\bmaybe we\b/i] },
  { tag: 'bug',        patterns: [/\bbug\b/i, /\bbroken\b/i, /\bcrash(es|ed)?\b/i, /\bstack ?trace\b/i] },
  { tag: 'decision',   patterns: [/\bdecided\b/i, /\bdecision\b/i, /\bwe will\b/i, /\blet'?s (use|go with|ship)\b/i] },
  { tag: 'task',       patterns: [/\bneed to\b/i, /\bto-?do\b/i, /\bfollow[ -]?up\b/i, /\baction item\b/i] },
  { tag: 'question',   patterns: [/\?\s*$/m, /\bhow do\b/i, /\bwhat is\b/i, /\bwhy does\b/i] },
  { tag: 'user',       patterns: [/\buser(s)?\b/i, /\bcustomer(s)?\b/i, /\bonboarding\b/i] },
  { tag: 'devtools',   patterns: [/\bclaude ?code\b/i, /\bcodex\b/i, /\bcursor\b/i, /\bmcp\b/i, /\bllmx\b/i] },
  { tag: 'launch',     patterns: [/\blaunch(ing|ed)?\b/i, /\bship(ping|ped)?\b/i, /\brelease\b/i, /\bv0\.\d/i] },
  { tag: 'personal',   patterns: [/\bi (feel|think|wonder|hope)\b/i, /\bmy (plan|goal|idea)\b/i] },
];

const URGENCY_HIGH_PATTERNS: RegExp[] = [
  /\basap\b/i,
  /\burgent\b/i,
  /\bbroken\b/i,
  /\bcrash(es|ed)?\b/i,
  /\bblocking\b/i,
  /!{2,}/,
];

export function classify(text: string, opts: { projectHint?: string | null } = {}): ClassifyResult {
  const confidences: Record<string, number> = {};
  for (const rule of TAG_RULES) {
    let hits = 0;
    for (const p of rule.patterns) {
      if (p.test(text)) hits += 1;
    }
    if (hits === 0) continue;
    // Simple confidence: hits / patterns, capped at 1.
    const conf = Math.min(1, hits / rule.patterns.length + 0.4);
    if (conf >= 0.5) {
      confidences[rule.tag] = Number(conf.toFixed(2));
    }
  }
  const tags = Object.keys(confidences).sort();
  const urgency = inferUrgency(text);
  const project = inferProject(text, opts.projectHint ?? null);
  return { tags, urgency, project, confidences };
}

export function toClassifiedEntry(args: {
  inboxId: string;
  text: string;
  projectHint?: string | null;
  classifiedAt?: Date;
}): ClassifiedEntry {
  const r = classify(args.text, { projectHint: args.projectHint });
  return {
    inbox_id: args.inboxId,
    classified_at: (args.classifiedAt ?? new Date()).toISOString(),
    tags: r.tags,
    urgency: r.urgency,
    project: r.project,
    llmx_project: null,
    schema_version: 1,
  };
}

function inferUrgency(text: string): Urgency {
  for (const p of URGENCY_HIGH_PATTERNS) {
    if (p.test(text)) return 'high';
  }
  if (/\bsoon\b/i.test(text) || /\bthis week\b/i.test(text)) return 'med';
  return 'low';
}

function inferProject(text: string, hint: string | null): string | null {
  if (hint) return hint;
  // Look for `#project-name` markers (a convention we'll document in the README).
  const m = text.match(/(?:^|\s)#([a-z0-9][a-z0-9_-]{1,30})/i);
  return m ? m[1].toLowerCase() : null;
}
