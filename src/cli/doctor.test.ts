/**
 * Tests for `llmx doctor` — uses the built dist/ to exercise the command end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'dist', 'cli', 'index.js');

function run(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const r = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}

let workDir = '';

beforeAll(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-doctor-test-'));
  const init = run(['init', '--name', 'doctor-unit'], workDir);
  if (init.status !== 0) throw new Error(`init failed: ${init.stderr}`);
});

afterAll(async () => {
  if (workDir) await fs.rm(workDir, { recursive: true, force: true });
});

describe('llmx doctor', () => {
  it('reports OK on a fresh project', () => {
    const r = run(['doctor', '--json'], workDir);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.result).toBe('ok');
    expect(parsed.checks.find((c: { name: string }) => c.name === 'manifest-valid').status).toBe('ok');
    expect(parsed.checks.find((c: { name: string }) => c.name === 'llmx-dir-exists').status).toBe('ok');
  });

  it('reports ERROR on missing project.llmx/', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-empty-'));
    try {
      const r = run(['doctor', '--json'], empty);
      expect(r.status).toBe(2);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.result).toBe('error');
      expect(parsed.checks[0].name).toBe('llmx-dir-exists');
      expect(parsed.checks[0].status).toBe('error');
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });

  it('detects invalid JSONL in decisions', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-corrupt-'));
    try {
      const init = run(['init', '--name', 'corrupt-test'], isolated);
      expect(init.status).toBe(0);
      const add = run(['add-decision', 'Test decision', '--by', 'test'], isolated);
      expect(add.status).toBe(0);

      const decisionsPath = path.join(isolated, 'project.llmx', 'memory', 'decisions.jsonl');
      await fs.appendFile(decisionsPath, 'this is not valid json\n');

      const r = run(['doctor', '--json'], isolated);
      expect(r.status).toBe(2);
      const parsed = JSON.parse(r.stdout);
      const check = parsed.checks.find((c: { name: string }) => c.name === 'decisions-valid');
      expect(check.status).toBe('error');
      expect(check.stats.invalid).toBeGreaterThan(0);
    } finally {
      await fs.rm(isolated, { recursive: true, force: true });
    }
  });

  it('detects duplicate task IDs', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'llmx-dupes-'));
    try {
      const init = run(['init', '--name', 'dupes-test'], isolated);
      expect(init.status).toBe(0);
      const add = run(['task', 'add', 'First task'], isolated);
      expect(add.status).toBe(0);

      const tasksPath = path.join(isolated, 'project.llmx', 'memory', 'tasks.json');
      const list = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
      const firstId = list.tasks[0].id;
      list.tasks.push({ ...list.tasks[0], title: 'Duplicate', id: firstId });
      await fs.writeFile(tasksPath, JSON.stringify(list, null, 2));

      const r = run(['doctor'], isolated); // human-readable, exit 1 for WARN
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/tasks-valid.*duplicate/);
    } finally {
      await fs.rm(isolated, { recursive: true, force: true });
    }
  });

  it('human output shows icons and result line', () => {
    const r = run(['doctor'], workDir);
    expect(r.stdout).toMatch(/✓ manifest-valid/);
    expect(r.stdout).toMatch(/Result: (OK|WARN|ERROR)/);
  });
});
