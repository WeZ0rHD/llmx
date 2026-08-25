/**
 * Studio synthesiser (V1) — deterministic digest builder.
 *
 * Sprint 1: no LLM. Aggregates the last N days of inbox + classified
 * entries into a markdown digest with sections:
 *   - Themes (top tags)
 *   - Decisions (entries tagged 'decision' or 'launch')
 *   - Open questions (entries tagged 'question' or 'task')
 *   - Suggested angles (combinations of tags)
 *
 * Sprint 2+: optional LLM call (when LLMX_STUDIO_LLM=1) to generate
 * a narrative on top of the aggregated structure.
 */
import type { ClassifiedEntry } from './schema.js';

export interface InboxEntryForDigest {
  id: string;
  captured_at: string; // ISO
  source: string;
  body: string;        // markdown without frontmatter
  classified: ClassifiedEntry | null;
}

export interface DigestTheme {
  tag: string;
  count: number;
  sample_titles: string[];
}

export interface DigestStats {
  total_captured: number;
  total_classified: number;
  by_source: Record<string, number>;
  by_urgency: Record<'low' | 'med' | 'high', number>;
  period: { from: string; to: string; days: number };
}

export interface Digest {
  stats: DigestStats;
  themes: DigestTheme[];
  decisions: string[];
  open_questions: string[];
  suggested_angles: string[];
  generated_at: string;
}

export function buildDigest(
  entries: InboxEntryForDigest[],
  opts: { days?: number } = {},
): Digest {
  const days = opts.days ?? 7;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = entries.filter((e) => Date.parse(e.captured_at) >= cutoff);

  // Stats
  const bySource: Record<string, number> = {};
  const byUrgency: Record<'low' | 'med' | 'high', number> = { low: 0, med: 0, high: 0 };
  let classifiedCount = 0;
  for (const e of inWindow) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    if (e.classified) {
      classifiedCount += 1;
      byUrgency[e.classified.urgency] += 1;
    }
  }
  const dates = inWindow.map((e) => e.captured_at).sort();
  const period = {
    from: dates[0] ?? new Date(cutoff).toISOString(),
    to: dates[dates.length - 1] ?? new Date().toISOString(),
    days,
  };

  // Themes: top tags with sample bodies
  const tagBuckets = new Map<string, InboxEntryForDigest[]>();
  for (const e of inWindow) {
    if (!e.classified) continue;
    for (const t of e.classified.tags) {
      const bucket = tagBuckets.get(t) ?? [];
      bucket.push(e);
      tagBuckets.set(t, bucket);
    }
  }
  const themes: DigestTheme[] = [...tagBuckets.entries()]
    .map(([tag, items]) => ({
      tag,
      count: items.length,
      sample_titles: items.slice(0, 3).map((e) => firstLine(e.body)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Decisions / questions — single-line summaries
  const decisions = inWindow
    .filter((e) => e.classified?.tags.includes('decision') || e.classified?.tags.includes('launch'))
    .map((e) => `- ${firstLine(e.body)}  _(${e.classified!.tags.join(', ')})_`);
  const open_questions = inWindow
    .filter((e) => e.classified?.tags.includes('question') || e.classified?.tags.includes('task'))
    .map((e) => `- ${firstLine(e.body)}`);

  // Suggested angles: pairs of co-occurring tags
  const coOccurrences = new Map<string, Set<string>>();
  for (const e of inWindow) {
    if (!e.classified) continue;
    const tags = e.classified.tags;
    for (let i = 0; i < tags.length; i += 1) {
      for (let j = i + 1; j < tags.length; j += 1) {
        const [a, b] = [tags[i]!, tags[j]!].sort();
        const key = `${a}+${b}`;
        if (!coOccurrences.has(key)) coOccurrences.set(key, new Set());
        coOccurrences.get(key)!.add(firstLine(e.body));
      }
    }
  }
  const suggested_angles = [...coOccurrences.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5)
    .map(([k, samples]) => `- **${k.replace('+', ' × ')}** — ${[...samples].slice(0, 2).join(' / ')}`);

  return {
    stats: {
      total_captured: inWindow.length,
      total_classified: classifiedCount,
      by_source: bySource,
      by_urgency: byUrgency,
      period,
    },
    themes,
    decisions,
    open_questions,
    suggested_angles,
    generated_at: new Date().toISOString(),
  };
}

export function renderDigestMarkdown(digest: Digest): string {
  const lines: string[] = [];
  lines.push(`# Studio digest — ${digest.stats.period.from.slice(0, 10)} → ${digest.stats.period.to.slice(0, 10)}`);
  lines.push('');
  lines.push(`> ${digest.stats.total_captured} captured, ${digest.stats.total_classified} classified, last ${digest.stats.period.days} days.`);
  lines.push('');
  lines.push('## Stats');
  lines.push('');
  lines.push(`- By source: ${Object.entries(digest.stats.by_source).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);
  lines.push(`- By urgency: high=${digest.stats.by_urgency.high} med=${digest.stats.by_urgency.med} low=${digest.stats.by_urgency.low}`);
  lines.push('');
  if (digest.themes.length > 0) {
    lines.push('## Themes');
    lines.push('');
    for (const t of digest.themes) {
      lines.push(`### ${t.tag} (${t.count})`);
      for (const s of t.sample_titles) lines.push(`- ${s}`);
      lines.push('');
    }
  }
  if (digest.decisions.length > 0) {
    lines.push('## Decisions & launches');
    lines.push('');
    lines.push(...digest.decisions);
    lines.push('');
  }
  if (digest.open_questions.length > 0) {
    lines.push('## Open questions & tasks');
    lines.push('');
    lines.push(...digest.open_questions);
    lines.push('');
  }
  if (digest.suggested_angles.length > 0) {
    lines.push('## Suggested content angles');
    lines.push('');
    lines.push(...digest.suggested_angles);
    lines.push('');
  }
  lines.push(`---`);
  lines.push(`_Generated at ${digest.generated_at}_`);
  return lines.join('\n');
}

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 120 ? line.slice(0, 117) + '...' : line;
}
