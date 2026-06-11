/**
 * `llmx mcp` — boot the LLMX MCP stdio server.
 *
 * The actual server lives in `../mcp/index.ts`; this command is a thin
 * adapter that wires commander options to `runServer({ projectRoot })`.
 *
 * Behaviour:
 * - default `projectRoot` = current working directory.
 * - logs only to stderr (stdout is reserved for the MCP wire protocol).
 * - never returns until the client closes stdin.
 */
import path from 'node:path';
import { Command } from 'commander';

import { runServer } from '../mcp/index.js';
import { FriendlyError, printErr } from './context.js';

export function registerMcp(program: Command): void {
 program
 .command('mcp')
 .description('Start the LLMX MCP stdio server (v0.2 skeleton).')
 .option('-d, --dir <path>', 'Project root (defaults to current directory)')
 .action(async (opts: { dir?: string }) => {
 const projectRoot = path.resolve(opts.dir ?? process.cwd());
 try {
 await runServer({ projectRoot });
 } catch (err) {
 if (err instanceof FriendlyError) {
 printErr(err.message);
 }
 throw err;
 }
 });
}
