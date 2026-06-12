/**
 * Studio repository — owns the on-disk format for `~/.llmx/studio/`.
 *
 * Mirrors the discipline of the project-level `Repository`:
 * - All I/O goes through this class.
 * - Writes are atomic (write to .tmp, rename).
 * - Every mutating call takes an `actor` for the audit log.
 * - No LLM calls here. The classifier (V1) is a pure function in
 *   `classifier.ts`; the LLM-backed version will land in Sprint 2.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { resolveStudioPaths, type StudioPaths } from './paths.js';
import {
  ClassifiedEntrySchema,
  InboxEntryFrontmatterSchema,
  StudioManifestSchema,
  type ClassifiedEntry,
  type InboxEntryFrontmatter,
  type InboxSource,
  type StudioManifest,
} from './schema.js';
import { appendAudit, type RedactionConfig } from '../core/audit.js';

export interface StudioRepositoryOptions {
  root?: string;
  redaction?: RedactionConfig;
}

const DEFAULT_STUDIO_MANIFEST: Omit<StudioManifest, 'created_at'> = {
  llmxVersion: '0.3.0',
  schemaVersion: 1,
  counters: { inbox: 0, classified: 0 },
};

export class StudioRepository {
  readonly paths: StudioPaths;
  private redaction: RedactionConfig;

  constructor(opts: StudioRepositoryOptions = {}) {
    this.paths = resolveStudioPaths(opts.root);
    this.redaction = opts.redaction ?? { enabled: true, patterns: [] };
  }

  setRedaction(cfg: RedactionConfig): void {
    this.redaction = cfg;
  }

  /* ------------------------------------------------------------ */
  /* Lifecycle                                                     */
  /* ------------------------------------------------------------ */

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.paths.root);
      return true;
    } catch {
      return false;
    }
  }

  async init(actor: string): Promise<StudioManifest> {
    await fs.mkdir(this.paths.inboxDir, { recursive: true });
    await fs.mkdir(this.paths.classifiedDir, { recursive: true });
    await fs.mkdir(this.paths.tagsDir, { recursive: true });
    await fs.mkdir(this.paths.synthesesDir, { recursive: true });
    await fs.mkdir(this.paths.draftsDir, { recursive: true });
    await fs.mkdir(this.paths.publishedDir, { recursive: true });
    await fs.mkdir(this.paths.logsDir, { recursive: true });

    const manifest: StudioManifest = {
      ...DEFAULT_STUDIO_MANIFEST,
      created_at: new Date().toISOString(),
    };
    await this.writeJsonAtomic(this.paths.manifest, manifest);

    await appendAudit(this.paths.auditLog, {
      actor,
      action: 'studio.init',
      target: this.paths.root,
      result: 'ok',
    }, this.redaction);

    return manifest;
  }

  async loadManifest(): Promise<StudioManifest | null> {
    try {
      const raw = await fs.readFile(this.paths.manifest, 'utf8');
      return StudioManifestSchema.parse(JSON.parse(raw));
    } catch (err: unknown) {
      if (isNoEnt(err)) return null;
      throw err;
    }
  }

  private async bumpCounter(field: 'inbox' | 'classified', actor: string, action: string): Promise<void> {
    const current = (await this.loadManifest()) ?? {
      ...DEFAULT_STUDIO_MANIFEST,
      created_at: new Date().toISOString(),
    };
    const next: StudioManifest = {
      ...current,
      counters: { ...current.counters, [field]: current.counters[field] + 1 },
    };
    await this.writeJsonAtomic(this.paths.manifest, next);
    await appendAudit(this.paths.auditLog, {
      actor,
      action,
      target: this.paths.manifest,
      result: 'ok',
    }, this.redaction);
  }

  /* ------------------------------------------------------------ */
  /* Inbox                                                         */
  /* ------------------------------------------------------------ */

  /** Filename convention: `YYYY-MM-DD_<slug>_<shortid>.md`. */
  static buildInboxFilename(opts: { source: InboxSource; text: string; capturedAt: Date }): string {
    const date = opts.capturedAt.toISOString().slice(0, 10);
    const slug = slugify(opts.text, 32);
    const shortId = randomUUID().slice(0, 8);
    return `${date}_${slug}_${shortId}.md`;
  }

  async capture(opts: {
    text: string;
    source: InboxSource;
    actor: string;
    capturedAt?: Date;
  }): Promise<InboxEntryFrontmatter> {
    if (this.redaction.enabled) {
      opts.text = redact(opts.text, this.redaction);
    }
    const id = randomUUID();
    const capturedAt = opts.capturedAt ?? new Date();
    const filename = StudioRepository.buildInboxFilename({
      source: opts.source,
      text: opts.text,
      capturedAt,
    });
    const frontmatter: InboxEntryFrontmatter = {
      id,
      source: opts.source,
      captured_at: capturedAt.toISOString(),
      schema_version: 1,
    };
    const body = renderInboxMarkdown(frontmatter, opts.text);
    const target = path.join(this.paths.inboxDir, filename);
    await this.writeFileAtomic(target, body);
    await this.bumpCounter('inbox', opts.actor, 'studio.capture');
    return frontmatter;
  }

  async listInboxEntries(): Promise<{ filename: string; frontmatter: InboxEntryFrontmatter }[]> {
    const out: { filename: string; frontmatter: InboxEntryFrontmatter }[] = [];
    let names: string[];
    try {
      names = await fs.readdir(this.paths.inboxDir);
    } catch (err: unknown) {
      if (isNoEnt(err)) return [];
      throw err;
    }
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      const full = path.join(this.paths.inboxDir, name);
      const raw = await fs.readFile(full, 'utf8');
      const frontmatter = parseInboxFrontmatter(raw);
      if (frontmatter) out.push({ filename: name, frontmatter });
    }
    // Newest first.
    out.sort((a, b) => b.frontmatter.captured_at.localeCompare(a.frontmatter.captured_at));
    return out;
  }

  async readInboxBody(filename: string): Promise<string> {
    const full = path.join(this.paths.inboxDir, filename);
    const raw = await fs.readFile(full, 'utf8');
    const stripped = stripFrontmatter(raw);
    return stripped;
  }

  /* ------------------------------------------------------------ */
  /* Classified sidecars                                           */
  /* ------------------------------------------------------------ */

  async writeClassified(entry: ClassifiedEntry, actor: string): Promise<void> {
    const parsed = ClassifiedEntrySchema.parse(entry);
    const target = path.join(this.paths.classifiedDir, `${parsed.inbox_id}.json`);
    await this.writeJsonAtomic(target, parsed);
    await this.bumpCounter('classified', actor, 'studio.classify');
  }

  async readClassified(inboxId: string): Promise<ClassifiedEntry | null> {
    try {
      const raw = await fs.readFile(
        path.join(this.paths.classifiedDir, `${inboxId}.json`),
        'utf8',
      );
      return ClassifiedEntrySchema.parse(JSON.parse(raw));
    } catch (err: unknown) {
      if (isNoEnt(err)) return null;
      throw err;
    }
  }

  /* ------------------------------------------------------------ */
  /* Atomic write helpers                                          */
  /* ------------------------------------------------------------ */

  private async writeJsonAtomic(target: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${randomUUID()}`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  private async writeFileAtomic(target: string, body: string): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${randomUUID()}`;
    await fs.writeFile(tmp, body, 'utf8');
    await fs.rename(tmp, target);
  }
}

/* ------------------------------------------------------------ */
/* Markdown rendering                                            */
/* ------------------------------------------------------------ */

function renderInboxMarkdown(frontmatter: InboxEntryFrontmatter, body: string): string {
  const yaml = [
    '---',
    `id: ${frontmatter.id}`,
    `source: ${frontmatter.source}`,
    `captured_at: ${frontmatter.captured_at}`,
    `schema_version: ${frontmatter.schema_version}`,
    '---',
    '',
  ].join('\n');
  return yaml + body.trimEnd() + '\n';
}

function parseInboxFrontmatter(raw: string): InboxEntryFrontmatter | null {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const block = m[1];
  const obj: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const ix = line.indexOf(':');
    if (ix === -1) continue;
    const key = line.slice(0, ix).trim();
    const val = line.slice(ix + 1).trim();
    obj[key] = val;
  }
  const parsed = InboxEntryFrontmatterSchema.safeParse({
    id: obj.id,
    source: obj.source,
    captured_at: obj.captured_at,
    schema_version: Number(obj.schema_version ?? 1),
  });
  return parsed.success ? parsed.data : null;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/* ------------------------------------------------------------ */
/* Utilities                                                     */
/* ------------------------------------------------------------ */

function slugify(text: string, maxLen: number): string {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const out: string[] = [];
  let total = 0;
  for (const w of words) {
    if (total + w.length + 1 > maxLen) break;
    out.push(w);
    total += w.length + 1;
  }
  return out.join('-') || 'idea';
}

function isNoEnt(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'ENOENT';
}

// Re-export the redactor so consumers don't need a second import path.
import { redact } from '../core/audit.js';
export { redact };
