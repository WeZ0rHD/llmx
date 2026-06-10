/**
 * Root commander program. Wires up all subcommands.
 */
import { Command } from 'commander';
import { registerInit } from './init.js';
import { registerStatus } from './status.js';
import { registerDecisions } from './decisions.js';
import { registerTasks } from './tasks.js';
import { registerSession } from './session.js';
import { registerSkills } from './skills.js';
import { registerExport } from './export.js';
import { registerAudit } from './audit.js';
import { registerDoctor } from './doctor.js';
import { registerMcp } from './mcp.js';
import { FriendlyError } from './context.js';

export function run(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('llmx')
    .description('LLMX — One memory. Every agent. Open context layer for AI coding agents.')
    .version('0.1.0')
    .showHelpAfterError()
    .exitOverride();

 registerInit(program);
 registerStatus(program);
 registerDecisions(program);
 registerTasks(program);
 registerSession(program);
 registerSkills(program);
 registerExport(program);
 registerAudit(program);
 registerDoctor(program);
 registerMcp(program);

  return program.parseAsync(argv).then(() => undefined).catch((err) => {
    // Commander throws for --help, --version, unknown command, etc. The
    // top-level handler in index.ts already treats those correctly.
    if (err && err.code && typeof err.code === 'string' && err.code.startsWith('commander.')) {
      // Re-throw so index.ts exits with the correct code (0 for help/version,
      // non-zero for parse errors).
      throw err;
    }
    if (err instanceof FriendlyError) {
      // Already printed by the command — exit non-zero.
      process.exit(1);
    }
    throw err;
  });
}
