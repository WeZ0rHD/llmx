/**
 * `llmx studio` — subcommand group.
 *
 * Sprint 1: `init`, `capture`, `classify`, `inbox`.
 * Sprint 2+ will add `synthesize`, `draft`, `syntheses`, `drafts`.
 */
import { Command } from 'commander';

import { StudioRepository } from '../studio/repository.js';
import { toClassifiedEntry } from '../studio/classifier.js';
import { FriendlyError } from './context.js';

export function registerStudio(program: Command): void {
  const studio = program
    .command('studio')
    .description('Personal content studio: capture, classify, synthesize, draft.');

  studio
    .command('init')
    .description('Initialize the personal studio workspace (~/.llmx/studio/).')
    .action(async () => {
      const repo = new StudioRepository();
      if (await repo.exists()) {
        throw new FriendlyError(`Studio already initialized at ${repo.paths.root}`);
      }
      const manifest = await repo.init('llmx-cli');
      process.stdout.write(`Studio initialized at ${repo.paths.root}\n`);
      process.stdout.write(`Schema v${manifest.schemaVersion}, LLMX ${manifest.llmxVersion}\n`);
    });

  studio
    .command('capture <text>')
    .description('Capture a text idea into the studio inbox.')
    .option('--from <source>', 'Source hint: text|voice|url|git|file|stdin', 'text')
    .action(async (text: string, opts: { from?: string }) => {
      const repo = new StudioRepository();
      if (!(await repo.exists())) {
        throw new FriendlyError(
          `No studio at ${repo.paths.root}. Run \`llmx studio init\` first.`,
        );
      }
      const source = normalizeSource(opts.from);
      const frontmatter = await repo.capture({ text, source, actor: 'llmx-cli' });
      process.stdout.write(`Captured ${frontmatter.id} (${source})\n`);
    });

  studio
    .command('classify')
    .description('Classify all unclassified inbox entries.')
    .option('--dry-run', 'Print the result without writing sidecars.')
    .action(async (opts: { dryRun?: boolean }) => {
      const repo = new StudioRepository();
      if (!(await repo.exists())) {
        throw new FriendlyError(
          `No studio at ${repo.paths.root}. Run \`llmx studio init\` first.`,
        );
      }
      const entries = await repo.listInboxEntries();
      if (entries.length === 0) {
        process.stdout.write('No inbox entries to classify.\n');
        return;
      }
      let classified = 0;
      let skipped = 0;
      for (const entry of entries) {
        const existing = await repo.readClassified(entry.frontmatter.id);
        if (existing) {
          skipped += 1;
          continue;
        }
        const body = await repo.readInboxBody(entry.filename);
        const ce = toClassifiedEntry({
          inboxId: entry.frontmatter.id,
          text: body,
        });
        if (opts.dryRun) {
          process.stdout.write(
            `[dry-run] ${entry.filename} -> ${JSON.stringify(ce)}\n`,
          );
        } else {
          await repo.writeClassified(ce, 'llmx-cli');
          classified += 1;
        }
      }
      const verb = opts.dryRun ? 'previewed' : 'classified';
      process.stdout.write(
        `${verb} ${classified} entries (skipped ${skipped} already classified).\n`,
      );
    });

  studio
    .command('inbox')
    .description('List inbox entries (newest first).')
    .option('--limit <n>', 'Max entries to show', '20')
    .action(async (opts: { limit?: string }) => {
      const repo = new StudioRepository();
      if (!(await repo.exists())) {
        throw new FriendlyError(
          `No studio at ${repo.paths.root}. Run \`llmx studio init\` first.`,
        );
      }
      const limit = Number.parseInt(opts.limit ?? '20', 10);
      const entries = await repo.listInboxEntries();
      const shown = entries.slice(0, limit);
      if (shown.length === 0) {
        process.stdout.write('Inbox is empty. Try: llmx studio capture "your idea here"\n');
        return;
      }
      for (const e of shown) {
        const classified = await repo.readClassified(e.frontmatter.id);
        const tags = classified?.tags?.length ? ` [${classified.tags.join(', ')}]` : '';
        process.stdout.write(
          `${e.frontmatter.captured_at}  ${e.filename}${tags}\n`,
        );
      }
      if (entries.length > shown.length) {
        process.stdout.write(`\n(${entries.length - shown.length} more — use --limit to see more)\n`);
      }
    });
}

function normalizeSource(input: string | undefined): 'text' | 'voice' | 'url' | 'git' | 'file' | 'stdin' {
  const allowed = ['text', 'voice', 'url', 'git', 'file', 'stdin'] as const;
  const v = (input ?? 'text').toLowerCase();
  if ((allowed as readonly string[]).includes(v)) return v as 'text' | 'voice' | 'url' | 'git' | 'file' | 'stdin';
  throw new FriendlyError(
    `Unknown source '${input}'. Allowed: ${allowed.join(', ')}`,
  );
}
