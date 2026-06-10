/**
 * `llmx doctor` — run self-checks on a `project.llmx/` and report OK/WARN/ERROR.
 */
import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs/promises';
import { requireRepo, printInfo, FriendlyError, ACTOR } from './context.js';

type CheckStatus = 'ok' | 'warn' | 'error';

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  stats?: Record<string, number>;
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Run self-checks on the LLMX project (integrity, schema, refs)')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .option('--json', 'Output the report as JSON instead of a human-readable report')
    .action(async (opts: { dir?: string; json?: boolean }) => {
      const projectRoot = path.resolve(opts.dir ?? process.cwd());
      const checks: CheckResult[] = [];

      // Check 1: project.llmx/ exists
      const llmxDir = path.join(projectRoot, 'project.llmx');
      try {
        const stat = await fs.stat(llmxDir);
        if (stat.isDirectory()) {
          checks.push({ name: 'llmx-dir-exists', status: 'ok', detail: llmxDir });
        } else {
          checks.push({ name: 'llmx-dir-exists', status: 'error', detail: `${llmxDir} is not a directory` });
        }
      } catch {
        checks.push({ name: 'llmx-dir-exists', status: 'error', detail: `${llmxDir} not found. Run \`llmx init\` first.` });
        return report(checks, opts.json ?? false);
      }

      // Load repo (now safe)
      let repo;
      try {
        repo = await requireRepo(projectRoot);
      } catch (err) {
        if (err instanceof FriendlyError) {
          checks.push({ name: 'repo-loadable', status: 'error', detail: err.message });
        } else {
          throw err;
        }
        return report(checks, opts.json ?? false);
      }

      const p = repo.paths;

      // Check 2: manifest valid
      try {
        const manifest = await repo.readManifest();
        const keyCount = Object.keys(manifest).length;
        checks.push({
          name: 'manifest-valid',
          status: 'ok',
          detail: `${keyCount} keys, schema v${manifest.llmxVersion}`,
          stats: { keys: keyCount },
        });
      } catch (err) {
        checks.push({
          name: 'manifest-valid',
          status: 'error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }

      // Check 3: decisions.jsonl valid (uses repo paths, optional on fresh project)
      const decisionsCheck = await validateJsonl(p.decisions, 'decisions', true);
      checks.push(decisionsCheck);

      // Check 4: tasks.json valid + ID uniqueness (uses repo paths)
      const tasksCheck = await validateTasks(p.tasks);
      checks.push(tasksCheck);

      // Check 5: sessions/history.jsonl valid
      await repo.readSessionHistory();
      const historyCheck = await validateJsonl(p.sessionHistory, 'sessions', true);
      checks.push(historyCheck);

      // Check 6: audit.jsonl valid
      const auditCheck = await validateJsonl(p.auditLog, 'audit', true);
      checks.push(auditCheck);

      // Check 7: no orphan files
      const orphanCheck = await checkOrphans(llmxDir);
      checks.push(orphanCheck);

      // Audit the doctor run
      await repo.audit({ actor: ACTOR, action: 'doctor' });

      return report(checks, opts.json ?? false);
    });
}

async function validateJsonl(filePath: string, label: string, optional = false): Promise<CheckResult> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch {
    return {
      name: `${label}-valid`,
      status: optional ? 'ok' : 'warn',
      detail: optional ? `no ${label} yet (empty project)` : `${filePath} not found`,
      stats: { records: 0, invalid: 0 },
    };
  }
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  let invalid = 0;
  let firstBad = -1;
  for (let i = 0; i < lines.length; i++) {
    try {
      JSON.parse(lines[i]);
    } catch {
      invalid++;
      if (firstBad === -1) firstBad = i + 1;
    }
  }
  if (invalid === 0) {
    return {
      name: `${label}-valid`,
      status: 'ok',
      detail: `${lines.length} records, 0 invalid`,
      stats: { records: lines.length, invalid: 0 },
    };
  }
  return {
    name: `${label}-valid`,
    status: 'error',
    detail: `${lines.length} records, ${invalid} invalid (first at line ${firstBad})`,
    stats: { records: lines.length, invalid },
  };
}

async function validateTasks(filePath: string): Promise<CheckResult> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch {
    return { name: 'tasks-valid', status: 'ok', detail: 'no tasks yet (empty project)', stats: { records: 0, invalid: 0 } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { name: 'tasks-valid', status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
  const list = (parsed as { tasks?: unknown[] })?.tasks ?? [];
  const ids = new Set<string>();
  const dupes: string[] = [];
  for (const t of list as Array<{ id?: string }>) {
    if (typeof t.id === 'string') {
      if (ids.has(t.id)) dupes.push(t.id);
      ids.add(t.id);
    }
  }
  if (dupes.length > 0) {
    return {
      name: 'tasks-valid',
      status: 'warn',
      detail: `${list.length} tasks, ${dupes.length} duplicate IDs`,
      stats: { records: list.length, invalid: 0, dupes: dupes.length },
    };
  }
  return {
    name: 'tasks-valid',
    status: 'ok',
    detail: `${list.length} tasks, 0 duplicates`,
    stats: { records: list.length, invalid: 0 },
  };
}

const ALLOWED_DIRS = new Set(['memory', 'skills', 'sessions', 'agents', 'logs', 'tools']);
const ALLOWED_FILES = new Set(['manifest.json']);

async function checkOrphans(llmxDir: string): Promise<CheckResult> {
  const entries = await fs.readdir(llmxDir, { withFileTypes: true });
  const orphans: string[] = [];
  for (const e of entries) {
    if (e.isDirectory() && !ALLOWED_DIRS.has(e.name)) orphans.push(`${e.name}/`);
    else if (e.isFile() && !ALLOWED_FILES.has(e.name)) orphans.push(e.name);
  }
  if (orphans.length === 0) {
    return { name: 'no-orphans', status: 'ok', detail: 'all files tracked' };
  }
  return {
    name: 'no-orphans',
    status: 'warn',
    detail: `${orphans.length} untracked: ${orphans.join(', ')}`,
    stats: { orphans: orphans.length },
  };
}

function report(checks: CheckResult[], asJson: boolean): never {
  const result: CheckStatus = checks.some((c) => c.status === 'error')
    ? 'error'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok';

  if (asJson) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ result, checks }, null, 2));
  } else {
    printInfo('');
    const icons: Record<CheckStatus, string> = { ok: '✓', warn: '⚠', error: '✗' };
    for (const c of checks) {
      printInfo(`${icons[c.status]} ${c.name}: ${c.detail}`);
    }
    printInfo('');
    const summary: Record<CheckStatus, string> = { ok: 'OK', warn: 'WARN', error: 'ERROR' };
    printInfo(`Result: ${summary[result]}`);
  }

  const exitCode = result === 'error' ? 2 : result === 'warn' ? 1 : 0;
  process.exit(exitCode);
}
