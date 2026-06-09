/**
 * Zod schemas — single source of truth for LLMX data shapes.
 *
 * Every persisted file is described here. Validating on read and on write
 * keeps the on-disk format honest and the CLI predictable.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

export const ManifestSchema = z.object({
  llmxVersion: z.string().default('0.1.0'),
  schemaVersion: z.number().int().nonnegative().default(1),
  name: z.string().min(1),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
  agents: z.array(z.string()).default([]),
});
export type Manifest = z.output<typeof ManifestSchema>;

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'done', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  status: TaskStatusSchema.default('pending'),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
});
export type Task = z.output<typeof TaskSchema>;

export const TaskListSchema = z.object({
  schemaVersion: z.number().int().nonnegative().default(1),
  tasks: z.array(TaskSchema).default([]),
});
export type TaskList = z.output<typeof TaskListSchema>;

/* ------------------------------------------------------------------ */
/* Decisions (append-only JSONL)                                       */
/* ------------------------------------------------------------------ */

export const DecisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  rationale: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  decidedBy: z.string().optional(), // e.g. "claude-code", "codex", "human"
  createdAt: z.string(),
});
export type Decision = z.output<typeof DecisionSchema>;

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export const SessionSummarySchema = z.object({
  id: z.string().min(1),
  agent: z.string().min(1), // e.g. "claude-code", "codex"
  summary: z.string().min(1),
  changedFiles: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type SessionSummary = z.output<typeof SessionSummarySchema>;

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export const PreferencesSchema = z.object({
  schemaVersion: z.number().int().nonnegative().default(1),
  preferences: z.record(z.string(), z.unknown()).default({}),
});
export type Preferences = z.output<typeof PreferencesSchema>;

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const SkillIndexEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  path: z.string().min(1), // path relative to skills/
});
export type SkillIndexEntry = z.output<typeof SkillIndexEntrySchema>;

export const SkillIndexSchema = z.object({
  schemaVersion: z.number().int().nonnegative().default(1),
  skills: z.array(SkillIndexEntrySchema).default([]),
});
export type SkillIndex = z.output<typeof SkillIndexSchema>;

/* ------------------------------------------------------------------ */
/* Agents config                                                       */
/* ------------------------------------------------------------------ */

export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  preferences: z.record(z.string(), z.unknown()).default({}),
});
export type AgentConfig = z.output<typeof AgentConfigSchema>;

/* ------------------------------------------------------------------ */
/* Tools / MCP config                                                  */
/* ------------------------------------------------------------------ */

export const McpServerEntrySchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true),
});
export type McpServerEntry = z.output<typeof McpServerEntrySchema>;

export const McpConfigSchema = z.object({
  schemaVersion: z.number().int().nonnegative().default(1),
  localOnly: z.boolean().default(true),
  autoExecShell: z.boolean().default(false),
  readEnvFiles: z.boolean().default(false),
  redaction: z
    .object({
      enabled: z.boolean().default(true),
      patterns: z.array(z.string()).default([]),
    })
    .default({ enabled: true, patterns: [] }),
  servers: z.array(McpServerEntrySchema).default([]),
});
export type McpConfig = z.output<typeof McpConfigSchema>;

/* ------------------------------------------------------------------ */
/* Audit log entry (JSONL, append-only)                                */
/* ------------------------------------------------------------------ */

export const AuditEntrySchema = z.object({
  ts: z.string(),
  actor: z.string(), // e.g. "llmx-cli", "llmx-mcp", "user"
  action: z.string(), // e.g. "init", "add-task", "add-decision", "session-save"
  target: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type AuditEntry = z.output<typeof AuditEntrySchema>;
