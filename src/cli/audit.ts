/**
 * `llmx audit` — print the most recent audit log entries.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printInfo, printErr, FriendlyError, formatRelative } from './context.js';

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerAudit(program: Command): void {
  program
    .command('audit')
    .description('Show recent entries from project.llmx/logs/audit.jsonl')
    .option('-n, --limit <n>', 'Number of entries to show', '20')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { limit: string; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const limit = Math.max(1, Math.min(500, parseInt(opts.limit, 10) || 20));
        const entries = await repo.readAuditLog(limit);
        if (entries.length === 0) {
          printInfo('Audit log is empty.');
          return;
        }
        for (const e of entries) {
          const target = e.target ? `  → ${e.target}` : '';
          printInfo(`${e.ts}  [${e.actor}] ${e.action}${target}  (${formatRelative(e.ts)})`);
        }
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}
