import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { StudioRepository } from '../../src/studio/repository.js';
import { classify, toClassifiedEntry } from '../../src/studio/classifier.js';
import { InboxEntryFrontmatterSchema } from '../../src/studio/schema.js';

let tmpDir: string;
let repo: StudioRepository;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-studio-test-'));
  repo = new StudioRepository({ root: tmpDir });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('StudioRepository.init', () => {
  it('creates the full directory tree and a manifest', async () => {
    const m = await repo.init('test');
    expect(m.schemaVersion).toBe(1);
    expect(m.llmxVersion).toBe('0.3.0');
    expect(m.counters).toEqual({ inbox: 0, classified: 0 });
    // Directories exist
    for (const d of [
      repo.paths.inboxDir,
      repo.paths.classifiedDir,
      repo.paths.tagsDir,
      repo.paths.synthesesDir,
      repo.paths.draftsDir,
      repo.paths.publishedDir,
      repo.paths.logsDir,
    ]) {
      const stat = await fs.stat(d);
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it('records the init in the audit log', async () => {
    await repo.init('test');
    const log = await fs.readFile(repo.paths.auditLog, 'utf8');
    expect(log).toContain('"action":"studio.init"');
    expect(log).toContain('"actor":"test"');
  });
});

describe('StudioRepository.capture', () => {
  beforeEach(async () => {
    await repo.init('test');
  });

  it('writes a markdown file with valid frontmatter and bumps the inbox counter', async () => {
    const fm = await repo.capture({
      text: 'Pricing should be usage-based not seat-based',
      source: 'text',
      actor: 'test',
    });
    expect(InboxEntryFrontmatterSchema.safeParse(fm).success).toBe(true);

    const files = await fs.readdir(repo.paths.inboxDir);
    expect(files).toHaveLength(1);
    const raw = await fs.readFile(path.join(repo.paths.inboxDir, files[0]!), 'utf8');
    expect(raw).toMatch(/^---\n/);
    expect(raw).toContain('source: text');
    expect(raw).toContain('Pricing should be usage-based');

    const m = await repo.loadManifest();
    expect(m?.counters.inbox).toBe(1);
  });

  it('redacts known secret patterns from the captured text', async () => {
    await repo.capture({
      text: 'Here is a key ghp_abcdefghijklmnopqrstuvwxyz1234 to test',
      source: 'text',
      actor: 'test',
    });
    const files = await fs.readdir(repo.paths.inboxDir);
    const raw = await fs.readFile(path.join(repo.paths.inboxDir, files[0]!), 'utf8');
    expect(raw).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz1234');
    expect(raw).toContain('[REDACTED]');
  });
});

describe('StudioRepository.inbox listing', () => {
  beforeEach(async () => {
    await repo.init('test');
  });

  it('returns empty list on a fresh studio', async () => {
    const entries = await repo.listInboxEntries();
    expect(entries).toEqual([]);
  });

  it('returns entries newest first with valid frontmatter', async () => {
    await repo.capture({ text: 'first idea', source: 'text', actor: 'test' });
    // Force a different captured_at for the second one.
    await new Promise((r) => setTimeout(r, 10));
    await repo.capture({ text: 'second idea', source: 'text', actor: 'test' });

    const entries = await repo.listInboxEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.frontmatter.captured_at >= entries[1]!.frontmatter.captured_at).toBe(true);
  });
});

describe('StudioRepository.classify', () => {
  beforeEach(async () => {
    await repo.init('test');
  });

  it('writes a sidecar and bumps the classified counter', async () => {
    const fm = await repo.capture({
      text: 'Pricing should be usage-based',
      source: 'text',
      actor: 'test',
    });
    const ce = toClassifiedEntry({ inboxId: fm.id, text: 'Pricing should be usage-based' });
    await repo.writeClassified(ce, 'test');

    const back = await repo.readClassified(fm.id);
    expect(back).not.toBeNull();
    expect(back!.tags).toContain('pricing');
    const m = await repo.loadManifest();
    expect(m?.counters.classified).toBe(1);
  });

  it('returns null for an inbox id with no sidecar yet', async () => {
    const back = await repo.readClassified('does-not-exist');
    expect(back).toBeNull();
  });
});

describe('classify() (V1 heuristic)', () => {
  it('tags pricing content', () => {
    const r = classify('Pricing should be usage-based not seat-based');
    expect(r.tags).toContain('pricing');
  });

  it('tags ideas', () => {
    const r = classify('Idea: we could add a /weekly command');
    expect(r.tags).toContain('idea');
  });

  it('flags high urgency for ASAP / broken', () => {
    expect(classify('This is broken ASAP').urgency).toBe('high');
    expect(classify('Just a thought for later').urgency).toBe('low');
  });

  it('extracts project from a #project-name marker', () => {
    const r = classify('Need to fix #studio today');
    expect(r.project).toBe('studio');
  });

  it('returns no tags for empty text', () => {
    const r = classify('   \n  ');
    expect(r.tags).toEqual([]);
  });
});
