/**
 * Session CLI: `llmx session save`, `llmx session show`, `llmx session list`.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printOk, printInfo, printErr, FriendlyError, formatRelative, truncate, ACTOR } from './context.js';

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerSession(program: Command): void {
  const session = program.command('session').description('Manage session summaries');

  session
    .command('save <summary>')
    .description('Save a session summary and update latest.md')
    .option('--agent <name>', 'Agent that produced this session (default: human)', 'human')
    .option('-f, --file <path...>', 'Changed file (repeatable)', (val: string, prev: string[]) => [...prev, val], [] as string[])
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (summary: string, opts: { agent?: string; file: string[]; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const entry = await repo.saveSessionSummary(
          { agent: opts.agent ?? 'human', summary, changedFiles: opts.file },
          ACTOR,
        );
        printOk(`Session saved (${entry.agent})`);
        printInfo(`  id: ${entry.id}`);
        printInfo(`  Updated: project.llmx/sessions/latest.md`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  session
    .command('list')
    .description('List session history, newest first')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const all = await repo.readSessionHistory();
        if (all.length === 0) {
          printInfo('No session history yet.');
          return;
        }
        for (const s of [...all].reverse()) {
          printInfo(`• [${s.agent}] ${formatRelative(s.createdAt)}  — ${truncate(s.summary, 80)}`);
          printInfo(`    id: ${s.id}  ·  ${s.changedFiles.length} file(s)`);
        }
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  session
    .command('show')
    .description('Print the latest session summary')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const md = await repo.readLatestSession();
        printInfo(md.trimEnd());
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}
