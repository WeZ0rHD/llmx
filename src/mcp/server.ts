/**
 * LLMX MCP server — v0.2 skeleton.
 *
 * Wires the {@link TOOLS} registry from `./tools.ts` onto an `McpServer`
 * instance from `@modelcontextprotocol/sdk`, connected over a stdio
 * transport. The server is intentionally minimal: it registers the v0.2
 * baseline tools and starts listening on stdin/stdout.
 *
 * For tests and programmatic introspection, see {@link createMcpServer}
 * which builds the same server without attaching a transport.
 *
 * @module mcp/server
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Repository } from '../core/repository.js';
import { TOOL_ACTOR, TOOLS, type ToolContext, type ToolResult } from './tools.js';

/** Server identity advertised via the MCP `initialize` handshake. */
export const SERVER_NAME = 'llmx-mcp';
export const SERVER_VERSION = '0.2.0';

/**
 * Build an `McpServer` with all LLMX tools registered. The caller is
 * responsible for connecting it to a transport (typically a
 * {@link StdioServerTransport}).
 *
 * Exposed separately from {@link startStdioServer} so tests and the
 * future HTTP transport can reuse the same tool wiring.
 */
export function createMcpServer(repo: Repository): McpServer {
 const server = new McpServer(
 { name: SERVER_NAME, version: SERVER_VERSION },
 {
 capabilities: {
 // Tools only — no resources/prompts in the v0.2 skeleton.
 },
 },
 );

 const ctx: ToolContext = { repo, actor: TOOL_ACTOR };

 for (const tool of TOOLS) {
 // The SDK accepts a Zod object schema as `inputSchema`. Our tool defs
 // already use that shape, so we can pass them straight through.
 server.registerTool(
 tool.name,
 {
 description: tool.description,
 inputSchema: tool.inputSchema,
 },
 async (args): Promise<CallToolResult> => {
 const result = await tool.handler(args, ctx);
 return result as CallToolResult;
 },
 );
 }

 return server;
}

/**
 * Connect the given `McpServer` to stdio and return the transport so
 * callers can shut it down cleanly on SIGINT/SIGTERM.
 *
 * @throws if the server is already connected.
 */
export async function startStdioServer(repo: Repository): Promise<StdioServerTransport> {
 const server = createMcpServer(repo);
 const transport = new StdioServerTransport();
 await server.connect(transport);
 return transport;
}

/**
 * Re-export the tool result type so callers can type-check responses
 * without importing the SDK directly.
 */
export type { ToolResult };
