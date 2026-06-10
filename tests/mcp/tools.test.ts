/**
 * Unit + integration tests for the v0.2 MCP server skeleton.
 *
 * The structural tests inspect the tool registry directly (no stdio).
 * The integration test below spins up the actual server over stdio
 * and drives it with the SDK's `Client` + `StdioClientTransport` —
 * this catches wiring mistakes that structural tests miss (capability
 * registration, transport setup, request handler dispatch).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { Repository } from '../../src/core/repository.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { TOOLS, findTool } from '../../src/mcp/tools.js';

describe('MCP v0.2 skeleton — tool registry', () => {
 it('exposes the three baseline v0.2 tools', () => {
 const names = TOOLS.map((t) => t.name);
 expect(names).toContain('llmx_status');
 expect(names).toContain('llmx_read_decision');
 expect(names).toContain('llmx_list_sessions');
 });

 it('every tool has a non-empty name and description', () => {
 for (const tool of TOOLS) {
 expect(tool.name).toMatch(/^llmx_[a-z_]+$/);
 expect(tool.description.length).toBeGreaterThan(10);
 expect(tool.inputSchema).toBeTypeOf('object');
 expect(typeof tool.handler).toBe('function');
 }
 });

 it('findTool returns the right tool by name', () => {
 expect(findTool('llmx_status')?.name).toBe('llmx_status');
 expect(findTool('nope')).toBeUndefined();
 });

 it('every tool input schema parses a safe default payload', () => {
 // llmx_status expects {} — should parse.
 const status = findTool('llmx_status');
 expect(status).toBeDefined();
 const parsedStatus = status!.inputSchema.safeParse({});
 expect(parsedStatus.success).toBe(true);

 // llmx_read_decision accepts either {} or { id, limit }.
 const rd = findTool('llmx_read_decision');
 expect(rd).toBeDefined();
 expect(rd!.inputSchema.safeParse({}).success).toBe(true);
 expect(rd!.inputSchema.safeParse({ id: 'abc', limit:5 }).success).toBe(true);
 expect(rd!.inputSchema.safeParse({ limit: -1 }).success).toBe(false);

 // llmx_list_sessions accepts an optional limit.
 const ls = findTool('llmx_list_sessions');
 expect(ls).toBeDefined();
 expect(ls!.inputSchema.safeParse({}).success).toBe(true);
 expect(ls!.inputSchema.safeParse({ limit:10 }).success).toBe(true);
 });
});

describe('MCP v0.2 skeleton — server wiring', () => {
 it('createMcpServer returns an McpServer instance', () => {
 const repo = new Repository({ projectRoot: process.cwd() });
 const server = createMcpServer(repo);
 expect(server).toBeInstanceOf(McpServer);
 });

 it('every declared tool appears in the McpServer internal registry', () => {
 const repo = new Repository({ projectRoot: process.cwd() });
 const server = createMcpServer(repo);
 // McpServer stores registered tools in a private object named
 // `_registeredTools`. We poke it for the assertion — the SDK does
 // not expose a public list, and we only need a structural check.
 const registered = (server as unknown as {
 _registeredTools?: Record<string, unknown>;
 })._registeredTools;
 expect(registered).toBeDefined();
 const registeredNames = Object.keys(registered!).sort();
 expect(registeredNames).toEqual([...TOOLS.map((t) => t.name)].sort());
 });
});

describe('MCP v0.2 skeleton — stdio integration', () => {
 it('the entry point boots and serves tools over stdio', async () => {
 // Use a fresh tmp project so the test is hermetic.
 const dir = mkdtempSync(path.join(tmpdir(), 'llmx-mcp-it-'));
 try {
 const repo = new Repository({ projectRoot: dir });
 await repo.init({ name: 'it', actor: 'vitest' });
 await repo.addDecision({ title: 'Test decision' }, 'vitest');

 const entry = path.resolve(__dirname, '../../dist/mcp/index.js');
 const transport = new StdioClientTransport({
 command: 'node',
 args: [entry, dir],
 stderr: 'pipe',
 });
 const client = new Client({ name: 'vitest', version: '0.0.1' }, { capabilities: {} });
 await client.connect(transport);

 try {
 const tools = await client.listTools();
 const names = tools.tools.map((t) => t.name).sort();
 expect(names).toEqual(['llmx_list_sessions', 'llmx_read_decision', 'llmx_status']);

 // Call llmx_status against a fresh init'd repo.
 const status = await client.callTool({ name: 'llmx_status', arguments: {} });
 expect(status.isError).toBeFalsy();
 const parsed = JSON.parse((status.content[0] as { text: string }).text);
 expect(parsed.ok).toBe(true);
 expect(parsed.manifest.name).toBe('it');
 expect(parsed.counts.decisions).toBe(1);

 // Call llmx_read_decision with no id → should return the one we added.
 const rd = await client.callTool({
 name: 'llmx_read_decision',
 arguments: {},
 });
 expect(rd.isError).toBeFalsy();
 const decisions = JSON.parse((rd.content[0] as { text: string }).text);
 expect(Array.isArray(decisions)).toBe(true);
 expect(decisions.length).toBe(1);
 expect(decisions[0].title).toBe('Test decision');
 } finally {
 await client.close();
 }
 } finally {
 rmSync(dir, { recursive: true, force: true });
 }
 },15000);
});
