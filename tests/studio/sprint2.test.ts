import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { StudioRepository } from '../../src/studio/repository.js';
import { toClassifiedEntry } from '../../src/studio/classifier.js';
import { buildDigest, renderDigestMarkdown, type InboxEntryForDigest } from '../../src/studio/synthesizer.js';
import { buildDrafts } from '../../src/studio/drafter.js';

let tmpDir: string;
let repo: StudioRepository;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-studio-s2-'));
  repo = new StudioRepository({ root: tmpDir });
  await repo.init('test');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function entry(
  id: string,
  captured_at: string,
  body: string,
  tags: string[] = [],
  urgency: 'low' | 'med' | 'high' = 'low',
): InboxEntryForDigest {
  return {
    id,
    filename: `${id}.md`,
    captured_at,
    source: 'text',
    body,
    classified: tags.length > 0
      ? {
          inbox_id: id,
          classified_at: captured_at,
          tags,
          urgency,
          project: null,
          llmx_project: null,
          schema_version: 1,
        }
      : null,
  };
}

describe('buildDigest', () => {
  it('counts captured and classified in the window only', () => {
    const now = new Date('2026-06-11T10:00:00Z');
    const inWindow = now.toISOString();
    const outOfWindow = new Date('2025-01-01T00:00:00Z').toISOString();
    const digest = buildDigest(
      [
        entry('a', inWindow, 'Pricing', ['pricing']),
        entry('b', inWindow, 'Idea', ['idea']),
        entry('c', outOfWindow, 'Old stuff', ['pricing']),
      ],
      { days: 7 },
    );
    expect(digest.stats.total_captured).toBe(2);
    expect(digest.stats.total_classified).toBe(2);
    expect(digest.themes.find((t) => t.tag === 'pricing')?.count).toBe(1);
  });

  it('flags decisions and open questions correctly', () => {
    const now = new Date().toISOString();
    const digest = buildDigest([
      entry('a', now, 'We decided to ship v0.3 today', ['decision']),
      entry('b', now, 'How do we handle auth?', ['question']),
      entry('c', now, 'Need to follow up on launch', ['task']),
    ]);
    expect(digest.decisions).toHaveLength(1);
    expect(digest.decisions[0]).toContain('decided to ship v0.3');
    expect(digest.open_questions).toHaveLength(2);
  });

  it('suggests co-occurring tag pairs as content angles', () => {
    const now = new Date().toISOString();
    const digest = buildDigest([
      entry('a', now, 'Pricing for devtools', ['pricing', 'devtools']),
      entry('b', now, 'Devtools pricing is tricky', ['devtools', 'pricing']),
    ]);
    expect(digest.suggested_angles[0]).toContain('devtools × pricing');
  });

  it('renders a markdown digest with all sections', () => {
    const digest = buildDigest([
      entry('a', new Date().toISOString(), 'Idea: weekly digest', ['idea']),
    ], { days: 7 });
    const md = renderDigestMarkdown(digest);
    expect(md).toContain('# Studio digest');
    expect(md).toContain('## Stats');
    expect(md).toContain('## Themes');
    expect(md).toContain('Generated at');
  });
});

describe('buildDrafts', () => {
  it('returns 3 drafts in 3 formats', () => {
    const drafts = buildDrafts({
      text: 'Pricing should be usage-based not seat-based',
      tags: ['pricing'],
      source: 'inbox',
    });
    expect(drafts.map((d) => d.format)).toEqual(['x-thread', 'linkedin', 'blog']);
  });

  it('injects tags as hashtags in the X thread and LinkedIn drafts', () => {
    const drafts = buildDrafts({
      text: 'Launch day',
      tags: ['launch', 'devtools'],
      source: 'release',
    });
    const x = drafts.find((d) => d.format === 'x-thread')!;
    expect(x.body).toContain('#launch');
    expect(x.body).toContain('#devtools');
  });

  it('uses a friendly placeholder when body is empty', () => {
    const drafts = buildDrafts({ text: '', tags: [], source: 'inbox' });
    expect(drafts[0]!.body).toContain('Untitled');
  });
});

describe('StudioRepository writeSynthesis / writeDraft', () => {
  it('writes a digest file under syntheses/ with ISO week name', async () => {
    const filename = await repo.writeSynthesis('# digest body', 'test');
    expect(filename).toMatch(/^\d{4}-W\d{2}\.md$/);
    const list = await repo.listSyntheses();
    expect(list).toHaveLength(1);
    expect(list[0]!.filename).toBe(filename);
  });

  it('writes 3 drafts under drafts/ when buildDrafts + writeDraft is called per format', async () => {
    const drafts = buildDrafts({ text: 'Hello', tags: ['idea'], source: 'inbox' });
    const written: string[] = [];
    for (const d of drafts) {
      const f = await repo.writeDraft({
        synthesisFilename: null,
        source: d.format === 'blog' ? 'inbox' : 'inbox',
        format: d.format,
        body: d.body,
        actor: 'test',
      });
      written.push(f);
    }
    expect(written).toHaveLength(3);
    const list = await repo.listDrafts();
    expect(list).toHaveLength(3);
  });
});
