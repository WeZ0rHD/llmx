/**
 * LLMX MCP entry point.
 *
 * `node dist/mcp/index.js` starts the stdio MCP server against a
 * project root. The CLI subcommand `llmx mcp` calls into
 * {@link runServer} so the same code path is used in both invocations.
 *
 * @module mcp
 */
import path from 'node:path';
import process from 'node:process';

import { Repository } from '../core/repository.js';
import { startStdioServer } from './server.js';

/** Default actor used for MCP-server-level audit events (server boot/shutdown). */
export const SERVER_ACTOR = 'llmx-mcp-server';

export interface RunServerOptions {
 projectRoot: string;
}

/**
 * Boot the MCP server against `projectRoot` and keep the event loop
 * alive until stdin closes (the parent MCP client terminates).
 *
 * Logs only to stderr — the MCP wire protocol owns stdout. Any write to
 * `process.stdout` outside the SDK transport would corrupt the JSON-RPC
 * stream and break the client connection.
 */
export async function runServer(opts: RunServerOptions): Promise<void> {
 const projectRoot = path.resolve(opts.projectRoot);
 const repo = new Repository({ projectRoot });
 // MCP servers don't auto-create an LLMX project — clients must run
 // `llmx init` first. We still bind a Repository so tool handlers can
 // surface a clean "no project" error rather than crashing on FS calls.
 const transport = await startStdioServer(repo);

 // eslint-disable-next-line no-console
 process.stderr.write(
 `[llmx-mcp] serving project at ${projectRoot} (transport: stdio)\n`,
 );

 // Graceful shutdown: when stdin EOFs, the SDK closes the transport
 // itself; we just need to keep the process alive until then.
 const onClose = (): void => {
 // eslint-disable-next-line no-console
 process.stderr.write('[llmx-mcp] stdin closed, exiting\n');
 transport.close().catch(() => undefined);
 };
 process.stdin.once('close', onClose);

 // Block forever — the SDK reads stdin asynchronously. Without this,
 // `node dist/mcp/index.js` would exit immediately.
 await new Promise<void>(() => undefined);
}

// Allow direct execution: `node dist/mcp/index.js [projectRoot]`.
if (import.meta.url === `file://${process.argv[1]}`) {
 const projectRoot = process.argv[2] ?? process.cwd();
 runServer({ projectRoot }).catch((err: unknown) => {
 // eslint-disable-next-line no-console
 process.stderr.write(
 `[llmx-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
 );
 process.exit(1);
 });
}
