/**
 * `llmx init` — bootstrap a `project.llmx/` directory in the current project.
 */
import { Command } from 'commander';
import path from 'node:path';
import { openRepo, printOk, printErr, FriendlyError, ACTOR } from './context.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize a new LLMX project in the current directory')
    .option('-n, --name <name>', 'Project name (defaults to current directory name)')
    .option('--no-example-skill', 'Skip creating the example skill')
    .option('-d, --dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { name?: string; exampleSkill?: boolean; dir?: string }) => {
      const projectRoot = path.resolve(opts.dir ?? process.cwd());
      const name = opts.name ?? path.basename(projectRoot);
      const repo = openRepo(projectRoot);

      try {
        if (await repo.exists()) {
          throw new FriendlyError(`LLMX project already initialized at ${repo.paths.root}. Use \`llmx status\` to inspect.`);
        }
        const manifest = await repo.init({
          name,
          actor: ACTOR,
          withExampleSkill: opts.exampleSkill !== false,
        });

        printOk(`Created ${repo.paths.root}/`);
        printOk('Created AGENTS.md');
        printOk('Created CLAUDE.md');
        printOk('Created default memory files (project-state, decisions, tasks, preferences, sessions, skills, agents, tools)');
        if (opts.exampleSkill !== false) {
          printOk('Created example skill: triage-bug');
        }
        printOk(`LLMX context initialized for "${manifest.name}"`);
        printOk(`Next: \`llmx add-decision "..."\` or \`llmx task add "..."\``);
      } catch (err) {
        if (err instanceof FriendlyError) {
          printErr(err.message);
        }
        throw err;
      }
    });
}
