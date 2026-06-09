/**
 * Task-related CLI: `llmx task add`, `llmx task list`, `llmx task update`, `llmx task show`.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printOk, printInfo, printErr, FriendlyError, formatRelative, truncate, ACTOR } from './context.js';
import type { TaskStatus } from '../core/index.js';

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled'];

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerTasks(program: Command): void {
  const tasks = program.command('task').alias('tasks').description('Manage project tasks');

  tasks
    .command('add <title>')
    .description('Add a new task to the project')
    .option('-d, --description <text>', 'Detailed description')
    .option('-t, --tag <tag>', 'Tag (repeatable)', (val: string, prev: string[]) => [...prev, val], [] as string[])
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (title: string, opts: { description?: string; tag: string[]; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const task = await repo.addTask({ title, description: opts.description, tags: opts.tag }, ACTOR);
        printOk(`Task added: ${task.title}`);
        printInfo(`  id: ${task.id}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  tasks
    .command('list')
    .description('List tasks (default: open tasks only)')
    .option('--all', 'Show all tasks including done/cancelled')
    .option('--status <status>', `Filter by status (${STATUSES.join(', ')})`)
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { all?: boolean; status?: string; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const list = await repo.readTasks();
        let filtered = list.tasks;
        if (opts.status) {
          if (!STATUSES.includes(opts.status as TaskStatus)) {
            printErr(`Invalid status: ${opts.status}. Expected one of: ${STATUSES.join(', ')}`);
          }
          filtered = filtered.filter((t) => t.status === opts.status);
        } else if (!opts.all) {
          filtered = filtered.filter((t) => t.status === 'pending' || t.status === 'in_progress');
        }
        if (filtered.length === 0) {
          printInfo('No tasks match.');
          return;
        }
        for (const t of filtered) {
          const tags = t.tags.length > 0 ? `  [${t.tags.join(', ')}]` : '';
          printInfo(`• [${t.status}] ${truncate(t.title, 80)}${tags}  (${formatRelative(t.updatedAt)})`);
          printInfo(`    id: ${t.id}`);
        }
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  tasks
    .command('show <id>')
    .description('Show task details by id (or unique prefix)')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (id: string, opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const list = await repo.readTasks();
        const matches = list.tasks.filter((t) => t.id.startsWith(id));
        if (matches.length === 0) {
          printErr(`No task found with id prefix: ${id}`);
        }
        if (matches.length > 1) {
          printErr(`Ambiguous id prefix: ${id} matches ${matches.length} tasks`);
        }
        const t = matches[0]!;
        printInfo(`Task: ${t.title}`);
        printInfo(`  id: ${t.id}`);
        printInfo(`  status: ${t.status}`);
        printInfo(`  created: ${t.createdAt}`);
        printInfo(`  updated: ${t.updatedAt}`);
        if (t.tags.length > 0) printInfo(`  tags: ${t.tags.join(', ')}`);
        if (t.description) printInfo('');
        printInfo(t.description);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  tasks
    .command('update <id>')
    .description('Update a task')
    .option('--status <status>', `Set status (${STATUSES.join(', ')})`)
    .option('--title <title>', 'New title')
    .option('--description <text>', 'New description')
    .option('--add-tag <tag>', 'Add a tag', (val: string, prev: string[]) => [...prev, val], [] as string[])
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (id: string, opts: { status?: string; title?: string; description?: string; addTag: string[]; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const list = await repo.readTasks();
        const match = list.tasks.find((t) => t.id === id) ?? list.tasks.find((t) => t.id.startsWith(id));
        if (!match) {
          printErr(`No task found with id: ${id}`);
        }
        if (opts.status && !STATUSES.includes(opts.status as TaskStatus)) {
          printErr(`Invalid status: ${opts.status}. Expected one of: ${STATUSES.join(', ')}`);
        }
        const patch: { title?: string; description?: string; status?: TaskStatus; tags?: string[] } = {};
        if (opts.title) patch.title = opts.title;
        if (opts.description) patch.description = opts.description;
        if (opts.status) patch.status = opts.status as TaskStatus;
        if (opts.addTag.length > 0) {
          const merged = new Set([...match.tags, ...opts.addTag]);
          patch.tags = Array.from(merged);
        }
        const updated = await repo.updateTask(match.id, patch, ACTOR);
        printOk(`Task updated: [${updated.status}] ${updated.title}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}
