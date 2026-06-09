import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Repository } from './index.js';

let tmpRoot: string;
let repo: Repository;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-test-'));
  repo = new Repository({ projectRoot: tmpRoot });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('Repository.init', () => {
  it('creates the full project.llmx/ tree', async () => {
    const manifest = await repo.init({ name: 'my-app', actor: 'test' });

    expect(manifest.name).toBe('my-app');
    expect(manifest.agents).toEqual(['claude-code', 'codex']);

    // All expected files exist
    const expected = [
      'manifest.json',
      'memory/project-state.md',
      'memory/decisions.jsonl',
      'memory/tasks.json',
      'memory/preferences.json',
      'sessions/latest.md',
      'sessions/history.jsonl',
      'skills/index.json',
      'agents/default.json',
      'tools/mcp.json',
      'logs/audit.jsonl',
      'AGENTS.md', // written at project root, not under project.llmx/
      'CLAUDE.md',
    ];
    for (const rel of expected) {
      const abs = rel === 'AGENTS.md' || rel === 'CLAUDE.md'
        ? path.join(tmpRoot, rel)
        : path.join(repo.paths.root, rel);
      await expect(fs.access(abs)).resolves.toBeUndefined();
    }
  });

  it('creates the example skill and indexes it', async () => {
    await repo.init({ name: 'my-app', actor: 'test' });
    const idx = await repo.readSkillIndex();
    expect(idx.skills.map((s) => s.name)).toContain('triage-bug');
  });

  it('is idempotent: refuses to overwrite', async () => {
    await repo.init({ name: 'my-app', actor: 'test' });
    await expect(repo.init({ name: 'my-app', actor: 'test' })).rejects.toThrow(/already initialized/);
  });

  it('emits an init audit entry', async () => {
    await repo.init({ name: 'my-app', actor: 'test' });
    const log = await repo.readAuditLog();
    expect(log.some((e) => e.action === 'init')).toBe(true);
  });
});

describe('Repository.tasks', () => {
  beforeEach(async () => {
    await repo.init({ name: 't', actor: 'test' });
  });

  it('adds and lists tasks', async () => {
    const t1 = await repo.addTask({ title: 'do the thing', tags: ['urgent'] }, 'test');
    const t2 = await repo.addTask({ title: 'second thing' }, 'test');
    const list = await repo.readTasks();
    expect(list.tasks).toHaveLength(2);
    expect(list.tasks[0]!.id).toBe(t1.id);
    expect(list.tasks[1]!.id).toBe(t2.id);
    expect(t1.status).toBe('pending');
    expect(t1.tags).toEqual(['urgent']);
  });

  it('updates task status', async () => {
    const t = await repo.addTask({ title: 'do it' }, 'test');
    const updated = await repo.updateTask(t.id, { status: 'done' }, 'test');
    expect(updated.status).toBe('done');
    const list = await repo.readTasks();
    expect(list.tasks[0]!.status).toBe('done');
  });

  it('rejects update for unknown id', async () => {
    await expect(repo.updateTask('does-not-exist', { status: 'done' }, 'test')).rejects.toThrow(/not found/i);
  });
});

describe('Repository.decisions', () => {
  beforeEach(async () => {
    await repo.init({ name: 't', actor: 'test' });
  });

  it('appends decisions in order', async () => {
    await repo.addDecision({ title: 'use pg' }, 'claude-code');
    await repo.addDecision({ title: 'use bun', decidedBy: 'codex' }, 'test');
    const all = await repo.readDecisions();
    expect(all).toHaveLength(2);
    expect(all[0]!.title).toBe('use pg');
    expect(all[1]!.decidedBy).toBe('codex');
  });

  it('persists decisions as JSONL (one per line)', async () => {
    await repo.addDecision({ title: 'a' }, 'test');
    await repo.addDecision({ title: 'b' }, 'test');
    const raw = await fs.readFile(repo.paths.decisions, 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).title).toBe('a');
    expect(JSON.parse(lines[1]!).title).toBe('b');
  });
});

describe('Repository.sessions', () => {
  beforeEach(async () => {
    await repo.init({ name: 't', actor: 'test' });
  });

  it('appends to history and prepends to latest.md', async () => {
    await repo.saveSessionSummary({ agent: 'claude-code', summary: 'first', changedFiles: ['a.ts'] }, 'test');
    await repo.saveSessionSummary({ agent: 'codex', summary: 'second', changedFiles: ['b.ts'] }, 'test');

    const history = await repo.readSessionHistory();
    expect(history.map((s) => s.summary)).toEqual(['first', 'second']);

    const latest = await repo.readLatestSession();
    // second entry should appear before the first
    expect(latest.indexOf('second')).toBeLessThan(latest.indexOf('first'));
  });
});

describe('Repository.skills', () => {
  beforeEach(async () => {
    await repo.init({ name: 't', actor: 'test' });
  });

  it('creates a skill and reads it back', async () => {
    const out = await repo.createSkill('my-skill', '# My Skill\n\nDo this.', {
      actor: 'test',
      description: 'Does things',
    });
    expect(out.name).toBe('my-skill');

    const idx = await repo.readSkillIndex();
    expect(idx.skills.find((s) => s.name === 'my-skill')).toBeDefined();

    const read = await repo.readSkill('my-skill');
    expect(read.body).toContain('My Skill');
  });

  it('refuses unsafe names', async () => {
    await expect(repo.createSkill('../escape', 'x', { actor: 'test' })).rejects.toThrow();
    await expect(repo.createSkill('UPPER', 'x', { actor: 'test' })).rejects.toThrow();
  });
});
