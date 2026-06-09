/**
 * `llmx skill` commands: create, list, show.
 */
import { Command } from 'commander';
import path from 'node:path';
import { requireRepo, printOk, printInfo, printErr, FriendlyError, ACTOR } from './context.js';

function rootOf(opts: { dir?: string }): string {
  return path.resolve(opts.dir ?? process.cwd());
}

export function registerSkills(program: Command): void {
  const skills = program.command('skill').alias('skills').description('Manage reusable skills');

  skills
    .command('create <name>')
    .description('Create a new skill (SKILL.md) under project.llmx/skills/<name>')
    .option('-d, --description <text>', 'One-line description')
    .option('-b, --body <text>', 'Skill body (Markdown). If omitted, a starter template is used.')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (name: string, opts: { description?: string; body?: string; dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const body = opts.body ?? defaultSkillBody(name, opts.description);
        const created = await repo.createSkill(name, body, { actor: ACTOR, description: opts.description });
        printOk(`Skill created: ${created.name}`);
        printInfo(`  path: ${created.path}`);
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  skills
    .command('list')
    .description('List skills known to this LLMX project')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const idx = await repo.readSkillIndex();
        if (idx.skills.length === 0) {
          printInfo('No skills yet. Use `llmx skill create <name>` to add one.');
          return;
        }
        for (const s of idx.skills) {
          printInfo(`• ${s.name}  — ${s.description}`);
        }
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });

  skills
    .command('show <name>')
    .description('Print the body of a skill (SKILL.md)')
    .option('--dir <path>', 'Project root (defaults to current directory)')
    .action(async (name: string, opts: { dir?: string }) => {
      const projectRoot = rootOf(opts);
      try {
        const repo = await requireRepo(projectRoot);
        const s = await repo.readSkill(name);
        printInfo(s.body.trimEnd());
      } catch (err) {
        if (err instanceof FriendlyError) printErr(err.message);
        throw err;
      }
    });
}

function defaultSkillBody(name: string, description?: string): string {
  const header = description ? `# ${name}\n\n> ${description}\n\n` : `# ${name}\n\n`;
  return (
    header +
    'Describe when this skill applies and the steps to follow.\n\n' +
    '## When to use\n\n' +
    '-\n\n' +
    '## Steps\n\n' +
    '1.\n'
  );
}
