/**
 * LLMX MCP tools — the canonical list of tools exposed by the stdio
 * server in v0.2.
 *
 * Each tool is declared as a {@link ToolDef} which carries enough
 * information to be:
 * - registered on an `McpServer` via `server.registerTool(...)`,
 * - inspected in tests without spinning up a transport,
 * - serialised into the spec / introspection output.
 *
 * Handlers receive a {@link ToolContext} that already has a Repository
 * bound to the current project root. They never touch `process` or
 * `console` directly — the MCP server owns the stdio channel.
 *
 * @module mcp/tools
 */
import { z } from 'zod';

import type { Repository } from '../core/repository.js';

/* ------------------------------------------------------------------ */
/* Tool context */
/* ------------------------------------------------------------------ */

export const TOOL_ACTOR = 'llmx-mcp';

/**
 * Per-call context passed to every tool handler. Holds the live
 * Repository and the actor name used for audit-log attribution.
 */
export interface ToolContext {
 repo: Repository;
 actor: string;
}

export type ToolHandler<Args extends z.ZodTypeAny = z.ZodTypeAny> = (
 args: z.output<Args>,
 ctx: ToolContext,
) => Promise<ToolResult> | ToolResult;

/**
 * Discriminated union for tool responses. Mirrors the wire shape used
 * by the MCP SDK (one or more `text` content blocks, optional `isError`).
 */
export interface ToolResult {
 content: Array<{ type: 'text'; text: string }>;
 isError?: boolean;
}

export function textResult(text: string): ToolResult {
 return { content: [{ type: 'text', text }] };
}

export function errorResult(text: string): ToolResult {
 return { content: [{ type: 'text', text }], isError: true };
}

export function jsonResult(data: unknown): ToolResult {
 return { content: [{ type: 'text', text: JSON.stringify(data, null,2) }] };
}

/* ------------------------------------------------------------------ */
/* Tool definitions */
/* ------------------------------------------------------------------ */

/**
 * A serialisable description of an MCP tool — the contract that both
 * the runtime server and the v0.2 spec agree on.
 */
export interface ToolDef<Args extends z.ZodTypeAny = z.ZodTypeAny> {
 /** Stable name exposed to MCP clients (e.g. `llmx_status`). */
 name: string;
 /** Human-readable description surfaced in the tools/list response. */
 description: string;
 /** Zod schema for the input parameters. */
 inputSchema: Args;
 /** Handler invoked when the tool is called. */
 handler: ToolHandler<Args>;
}

/* ------------------------------------------------------------------ */
/* llmx_status */
/* ------------------------------------------------------------------ */

const StatusInput = z.object({}).strict();

const statusHandler: ToolHandler<typeof StatusInput> = async (_args, ctx) => {
 if (!(await ctx.repo.exists())) {
 return errorResult(
 `No LLMX project found at ${ctx.repo.paths.root}. Run \`llmx init\` first.`,
 );
 }
 const manifest = await ctx.repo.readManifest();
 const tasks = await ctx.repo.readTasks();
 const decisions = await ctx.repo.readDecisions();
 const sessions = await ctx.repo.readSessionHistory();
 return jsonResult({
 ok: true,
 projectRoot: ctx.repo.projectRoot,
 llmxRoot: ctx.repo.paths.root,
 manifest: {
 name: manifest.name,
 llmxVersion: manifest.llmxVersion,
 schemaVersion: manifest.schemaVersion,
 agents: manifest.agents,
 },
 counts: {
 tasks: tasks.tasks.length,
 decisions: decisions.length,
 sessions: sessions.length,
 },
 });
};

/* ------------------------------------------------------------------ */
/* llmx_read_decision */
/* ------------------------------------------------------------------ */

const ReadDecisionInput = z.object({
 id: z.string().min(1).optional().describe('Decision ID; omit to return all decisions.'),
 limit: z
 .number()
 .int()
 .positive()
 .max(500)
 .optional()
 .describe('Max number of decisions to return when `id` is omitted (default50).'),
});

const readDecisionHandler: ToolHandler<typeof ReadDecisionInput> = async (args, ctx) => {
 const decisions = await ctx.repo.readDecisions();
 if (args.id) {
 const found = decisions.find((d) => d.id === args.id);
 if (!found) {
 return errorResult(`Decision not found: ${args.id}`);
 }
 return jsonResult(found);
 }
 const limit = args.limit ??50;
 return jsonResult(decisions.slice(-limit));
};

/* ------------------------------------------------------------------ */
/* llmx_list_sessions */
/* ------------------------------------------------------------------ */

const ListSessionsInput = z.object({
 limit: z
 .number()
 .int()
 .positive()
 .max(500)
 .optional()
 .describe('Max number of session summaries to return (default50).'),
});

const listSessionsHandler: ToolHandler<typeof ListSessionsInput> = async (args, ctx) => {
 const all = await ctx.repo.readSessionHistory();
 const limit = args.limit ??50;
 // Newest first.
 const out = all.slice(-limit).reverse();
 return jsonResult(out);
};

/* ------------------------------------------------------------------ */
/* Exported registry */
/* ------------------------------------------------------------------ */

/**
 * Canonical list of tools exposed by the LLMX MCP server in v0.2.
 *
 * Adding a tool: append an entry here with a stable `name` (snake_case,
 * `llmx_` prefix), a Zod input schema, and a handler. The server in
 * `src/mcp/server.ts` iterates this list at startup.
 */
export const TOOLS: ReadonlyArray<ToolDef> = [
 {
 name: 'llmx_status',
 description:
 'Return a short status summary of the current LLMX project: manifest, counts of tasks/decisions/sessions.',
 inputSchema: StatusInput,
 handler: statusHandler as ToolHandler,
 },
 {
 name: 'llmx_read_decision',
 description:
 'Read a single decision by ID, or list the most recent decisions when `id` is omitted.',
 inputSchema: ReadDecisionInput,
 handler: readDecisionHandler as ToolHandler,
 },
 {
 name: 'llmx_list_sessions',
 description: 'List recent session summaries (newest first).',
 inputSchema: ListSessionsInput,
 handler: listSessionsHandler as ToolHandler,
 },
] as const;

/** Quick lookup by name. Returns undefined for unknown tools. */
export function findTool(name: string): ToolDef | undefined {
 return TOOLS.find((t) => t.name === name);
}
