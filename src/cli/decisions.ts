/**
 * Decision-related CLI: `llmx add-decision`, `llmx decision add|list`.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printOk, printInfo, printErr, FriendlyError, formatRelative, truncate, ACTOR } from './context.js';

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerDecisions(program: Command): void {
  // Top-level shortcut: `llmx add-decision "..."`
  program
    .command('add-decision <title>')
    .description('Shortcut for `llmx decision add`')
    .option('-r, --rationale <text>', 'Why this decision was made')
    .option('-a, --alternatives <items...>', 'Alternatives that were considered')
    .option('--by <agent>', 'Who made the decision (e.g. claude-code, codex, human)')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .action(async (title: string, opts: { rationale?: string; alternatives?: string[]; by?: string; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const decision = await repo.addDecision(
          {
            title,
            rationale: opts.rationale,
            alternatives: opts.alternatives,
            decidedBy: opts.by,
          },
          ACTOR,
        );
        printOk(`Decision added: ${decision.title}`);
        printInfo(`  id: ${decision.id}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  const decisions = program.command('decision').alias('decisions').description('Manage project decisions');

  decisions
    .command('add <title>')
    .description('Add a new decision to the project')
    .option('-r, --rationale <text>', 'Why this decision was made')
    .option('-a, --alternatives <items...>', 'Alternatives that were considered')
    .option('--by <agent>', 'Who made the decision (e.g. claude-code, codex, human)')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .action(async (title: string, opts: { rationale?: string; alternatives?: string[]; by?: string; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const decision = await repo.addDecision(
          {
            title,
            rationale: opts.rationale,
            alternatives: opts.alternatives,
            decidedBy: opts.by,
          },
          ACTOR,
        );
        printOk(`Decision added: ${decision.title}`);
        printInfo(`  id: ${decision.id}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  decisions
    .command('list')
    .description('List all decisions, newest first')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const all = await repo.readDecisions();
        if (all.length === 0) {
          printInfo('No decisions yet. Use `llmx decision add "..."` to add one.');
          return;
        }
        for (const d of [...all].reverse()) {
          const by = d.decidedBy ? ` by ${d.decidedBy}` : '';
          printInfo(`• ${truncate(d.title, 80)}${by}  (${formatRelative(d.createdAt)})`);
          if (d.rationale) {
            printInfo(`    ${truncate(d.rationale, 100)}`);
          }
        }
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}
