/**
 * `llmx status` — print a human-readable summary of the local context.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printInfo, printErr, FriendlyError, formatRelative, truncate, ACTOR } from './context.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show a summary of the current LLMX project')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .option('--json', 'Output the status as JSON instead of a human-readable report')
    .action(async (opts: { dir?: string; json?: boolean }) => {
      const projectRoot = path.resolve(opts.dir ?? process.cwd());
      try {
        const repo = await requireRepo(projectRoot);
        const [manifest, tasks, decisions, history, skills, projectState] = await Promise.all([
          repo.readManifest(),
          repo.readTasks(),
          repo.readDecisions(),
          repo.readSessionHistory(),
          repo.readSkillIndex(),
          repo.readProjectState(),
        ]);

        const openTasks = tasks.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
        const doneTasks = tasks.tasks.filter((t) => t.status === 'done');
        const lastDecision = decisions[decisions.length - 1];
        const lastSession = history[history.length - 1];

        if (opts.json) {
          printInfo(JSON.stringify({
            manifest,
            counts: {
              tasks: tasks.tasks.length,
              tasksOpen: openTasks.length,
              tasksDone: doneTasks.length,
              decisions: decisions.length,
              sessions: history.length,
              skills: skills.skills.length,
            },
            lastDecision: lastDecision ?? null,
            lastSession: lastSession ?? null,
            paths: repo.paths,
          }, null, 2));
          return;
        }

        printInfo('');
        printInfo(`LLMX project: ${manifest.name}`);
        printInfo(`  Version: ${manifest.llmxVersion}  ·  Created: ${new Date(manifest.createdAt).toLocaleString()}`);
        printInfo(`  Path: ${repo.paths.root}`);
        printInfo('');
        printInfo(`Tasks`);
        printInfo(`  Total: ${tasks.tasks.length}   Open: ${openTasks.length}   Done: ${doneTasks.length}`);
        for (const t of openTasks.slice(0, 5)) {
          printInfo(`   • [${t.status}] ${truncate(t.title, 70)}  (${formatRelative(t.updatedAt)})`);
        }
        if (openTasks.length > 5) {
          printInfo(`   … and ${openTasks.length - 5} more`);
        }
        printInfo('');
        printInfo(`Decisions: ${decisions.length}`);
        if (lastDecision) {
          printInfo(`   latest: ${truncate(lastDecision.title, 70)}  (${formatRelative(lastDecision.createdAt)})`);
        }
        printInfo('');
        printInfo(`Sessions: ${history.length}`);
        if (lastSession) {
          printInfo(`   latest: ${lastSession.agent}  (${formatRelative(lastSession.createdAt)})`);
        }
        printInfo('');
        printInfo(`Skills: ${skills.skills.length}`);
        for (const s of skills.skills.slice(0, 5)) {
          printInfo(`   • ${s.name}  — ${truncate(s.description, 60)}`);
        }
        if (skills.skills.length > 5) {
          printInfo(`   … and ${skills.skills.length - 5} more`);
        }
        printInfo('');
        const hasContent = projectState.trim().length > 0 && !projectState.includes('## Goals\n\n-');
        if (hasContent) {
          printInfo(`Project state: ${projectState.split('\n').length} lines, last ${formatRelative(manifest.updatedAt)}`);
        } else {
          printInfo(`Project state: (still default template — edit project.llmx/memory/project-state.md)`);
        }
        // Touch actor to keep the audit log flowing.
        await repo.audit({ actor: ACTOR, action: 'status' });
      } catch (err) {
        if (err instanceof FriendlyError) {
          printErr(err.message);
        }
        throw err;
      }
    });
}
