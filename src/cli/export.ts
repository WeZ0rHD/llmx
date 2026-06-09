/**
 * `llmx export <agent>` — re-render the entry-point files for a target agent
 * (CLAUDE.md, AGENTS.md, etc.) from the current shared context.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printOk, printInfo, printErr, FriendlyError, truncate, ACTOR } from './context.js';
import { exportForClaudeCode } from '../adapters/claude-code/index.js';
import { exportForCodex } from '../adapters/codex/index.js';

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerExport(program: Command): void {
  const exp = program.command('export').description('Re-render entry-point files for a target agent');

  exp
    .command('claude')
    .description('Render CLAUDE.md from the current LLMX context')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const out = await exportForClaudeCode(repo);
        await repo.audit({ actor: ACTOR, action: 'export', target: 'claude', meta: { length: out.length } });
        printOk(`Rendered ${repo.paths.claudeFile} (${out.length} bytes)`);
        printInfo('Claude Code will pick it up on next session start.');
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  exp
    .command('codex')
    .description('Render AGENTS.md from the current LLMX context')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const out = await exportForCodex(repo);
        await repo.audit({ actor: ACTOR, action: 'export', target: 'codex', meta: { length: out.length } });
        printOk(`Rendered ${repo.paths.agentsFile} (${out.length} bytes)`);
        printInfo('Codex will read AGENTS.md on next session.');
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  exp
    .command('all')
    .description('Render entry points for all configured agents')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const claude = await exportForClaudeCode(repo);
        const codex = await exportForCodex(repo);
        await repo.audit({ actor: ACTOR, action: 'export', target: 'all' });
        printOk(`Rendered CLAUDE.md (${claude.length} bytes)`);
        printOk(`Rendered AGENTS.md (${codex.length} bytes)`);
        printInfo(`Truncated preview: ${truncate(codex.replace(/\n+/g, ' '), 100)}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}
