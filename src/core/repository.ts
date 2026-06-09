/**
 * LLMX repository — the only place that reads/writes the on-disk format.
 *
 * Design notes:
 * - All file paths are computed from a single project root.
 * - Reads tolerate missing files where reasonable (return safe defaults) —
 *   `init` is the only command expected to actually create the tree.
 * - Writes are atomic for JSON files (write to .tmp, rename).
 * - Decisions and session history are append-only JSONL.
 * - Every mutating call accepts an `actor` for the audit log; the CLI and
 *   MCP server pass different values to keep traces clean.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { resolvePaths, type LlmxPaths } from './paths.js';
import {
  AuditEntrySchema,
  DecisionSchema,
  ManifestSchema,
  McpConfigSchema,
  PreferencesSchema,
  SessionSummarySchema,
  SkillIndexSchema,
  TaskListSchema,
  TaskSchema,
  type AuditEntry,
  type Decision,
  type Manifest,
  type McpConfig,
  type Preferences,
  type SessionSummary,
  type SkillIndex,
  type Task,
  type TaskList,
} from './schema.js';
import {
  AGENTS_MD_TEMPLATE,
  CLAUDE_MD_TEMPLATE,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_MCP_CONFIG,
  EXAMPLE_SKILL_MD,
  EXAMPLE_SKILL_NAME,
  PREFERENCES_DEFAULT,
  PROJECT_STATE_MD_TEMPLATE,
  SESSION_LATEST_MD_TEMPLATE,
  SKILL_INDEX_DEFAULT,
  TASK_LIST_DEFAULT,
} from './defaults.js';
import { redact, type RedactionConfig } from './audit.js';

export interface RepositoryOptions {
  projectRoot: string;
  redaction?: RedactionConfig;
}

export class Repository {
  readonly paths: LlmxPaths;
  readonly projectRoot: string;
  private redaction: RedactionConfig;

  constructor(opts: RepositoryOptions) {
    this.projectRoot = path.resolve(opts.projectRoot);
    this.paths = resolvePaths(this.projectRoot);
    this.redaction = opts.redaction ?? { enabled: true, patterns: [] };
  }

  setRedaction(cfg: RedactionConfig): void {
    this.redaction = cfg;
  }

  /* ------------------------------------------------------------ */
  /* Init                                                          */
  /* ------------------------------------------------------------ */

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.paths.root);
      return true;
    } catch {
      return false;
    }
  }

  async init(opts: { name: string; actor: string; withExampleSkill?: boolean }): Promise<Manifest> {
    if (await this.exists()) {
      throw new RepositoryError('init', `LLMX project already initialized at ${this.paths.root}`);
    }

    const now = new Date().toISOString();

    await fs.mkdir(this.paths.memoryDir, { recursive: true });
    await fs.mkdir(this.paths.sessionsDir, { recursive: true });
    await fs.mkdir(this.paths.skillsDir, { recursive: true });
    await fs.mkdir(this.paths.agentsDir, { recursive: true });
    await fs.mkdir(this.paths.toolsDir, { recursive: true });
    await fs.mkdir(this.paths.logsDir, { recursive: true });

    const manifest = ManifestSchema.parse({
      llmxVersion: '0.1.0',
      schemaVersion: 1,
      name: opts.name,
      createdAt: now,
      updatedAt: now,
      agents: ['claude-code', 'codex'],
    }) as Manifest;

    await this.writeJson(this.paths.manifest, manifest);
    await this.writeText(this.paths.projectState, PROJECT_STATE_MD_TEMPLATE);
    await this.writeJson(this.paths.tasks, TaskListSchema.parse(TASK_LIST_DEFAULT) as TaskList);
    // decisions.jsonl default = empty file (append-only)
    await fs.writeFile(this.paths.decisions, '', 'utf8');
    // preferences.json default
    await this.writeJson(this.paths.preferences, PreferencesSchema.parse(PREFERENCES_DEFAULT) as Preferences);
    // sessions/latest.md default
    await this.writeText(this.paths.latestSession, SESSION_LATEST_MD_TEMPLATE);
    // sessions/history.jsonl default
    await fs.writeFile(this.paths.sessionHistory, '', 'utf8');
    // skills index
    await this.writeJson(this.paths.skillsIndex, SkillIndexSchema.parse(SKILL_INDEX_DEFAULT) as SkillIndex);
    // default agent
    await this.writeJson(this.paths.defaultAgent, DEFAULT_AGENT_CONFIG);
    // mcp config
    await this.writeJson(this.paths.mcpConfig, McpConfigSchema.parse(DEFAULT_MCP_CONFIG) as McpConfig);

    // top-level agent entry points
    await this.writeText(this.paths.agentsFile, AGENTS_MD_TEMPLATE);
    await this.writeText(this.paths.claudeFile, CLAUDE_MD_TEMPLATE);

    // example skill (optional)
    if (opts.withExampleSkill !== false) {
      await this.createSkill(EXAMPLE_SKILL_NAME, EXAMPLE_SKILL_MD, {
        actor: opts.actor,
        description: 'Reproduce a bug, propose a fix, add a task.',
      });
    }

    await this.audit({
      actor: opts.actor,
      action: 'init',
      target: this.paths.root,
      meta: { name: opts.name, withExampleSkill: opts.withExampleSkill !== false },
    });

    return manifest;
  }

  /* ------------------------------------------------------------ */
  /* Manifest                                                      */
  /* ------------------------------------------------------------ */

  async readManifest(): Promise<Manifest> {
    return this.readJson(this.paths.manifest, ManifestSchema) as Promise<Manifest>;
  }

  async updateManifest(patch: Partial<Pick<Manifest, 'name' | 'agents'>>, actor: string): Promise<Manifest> {
    const current = await this.readManifest();
    const next = ManifestSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }) as Manifest;
    await this.writeJson(this.paths.manifest, next);
    await this.audit({ actor, action: 'manifest-update', meta: { keys: Object.keys(patch) } });
    return next;
  }

  /* ------------------------------------------------------------ */
  /* Project state (markdown)                                      */
  /* ------------------------------------------------------------ */

  async readProjectState(): Promise<string> {
    return this.readText(this.paths.projectState);
  }

  async writeProjectState(markdown: string, actor: string): Promise<void> {
    await this.writeText(this.paths.projectState, markdown);
    await this.audit({ actor, action: 'project-state-write' });
  }

  /* ------------------------------------------------------------ */
  /* Tasks                                                         */
  /* ------------------------------------------------------------ */

  async readTasks(): Promise<TaskList> {
    try {
      return this.readJson(this.paths.tasks, TaskListSchema);
    } catch (err) {
      if (err instanceof RepositoryError && err.code === 'read') {
        // Treat a missing tasks.json as an empty list.
        return TaskListSchema.parse(TASK_LIST_DEFAULT) as TaskList;
      }
      throw err;
    }
  }

  async addTask(
    input: { title: string; description?: string; tags?: string[] },
    actor: string,
  ): Promise<Task> {
    const list = await this.readTasks();
    const now = new Date().toISOString();
    const raw = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
      tags: input.tags ?? [],
    };
    const parsed = TaskSchema.parse(raw) as Task;
    const next = TaskListSchema.parse({
      schemaVersion: list.schemaVersion,
      tasks: [...list.tasks, parsed],
    }) as TaskList;
    await this.writeJson(this.paths.tasks, next);
    await this.audit({ actor, action: 'task-add', target: parsed.id, meta: { title: parsed.title } });
    return parsed;
  }

  async updateTask(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'tags'>>,
    actor: string,
  ): Promise<Task> {
    const list = await this.readTasks();
    const idx = list.tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new RepositoryError('update-task', `Task not found: ${id}`);
    }
    const current = list.tasks[idx]!;
    const updated = TaskSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    }) as Task;
    const next = TaskListSchema.parse({
      schemaVersion: list.schemaVersion,
      tasks: list.tasks.map((t, i) => (i === idx ? updated : t)),
    }) as TaskList;
    await this.writeJson(this.paths.tasks, next);
    await this.audit({ actor, action: 'task-update', target: id, meta: { keys: Object.keys(patch) } });
    return updated;
  }

  /* ------------------------------------------------------------ */
  /* Decisions (append-only JSONL)                                 */
  /* ------------------------------------------------------------ */

  async readDecisions(): Promise<Decision[]> {
    return this.readJsonl(this.paths.decisions, DecisionSchema);
  }

  async addDecision(
    input: { title: string; rationale?: string; alternatives?: string[]; decidedBy?: string },
    actor: string,
  ): Promise<Decision> {
    const decision = DecisionSchema.parse({
      id: randomUUID(),
      title: input.title,
      rationale: input.rationale ?? '',
      alternatives: input.alternatives ?? [],
      decidedBy: input.decidedBy,
      createdAt: new Date().toISOString(),
    }) as Decision;
    await this.appendJsonl(this.paths.decisions, decision);
    await this.audit({ actor, action: 'decision-add', target: decision.id, meta: { title: decision.title } });
    return decision;
  }

  /* ------------------------------------------------------------ */
  /* Sessions                                                      */
  /* ------------------------------------------------------------ */

  async readLatestSession(): Promise<string> {
    return this.readText(this.paths.latestSession);
  }

  async readSessionHistory(): Promise<SessionSummary[]> {
    return this.readJsonl(this.paths.sessionHistory, SessionSummarySchema);
  }

  async saveSessionSummary(
    input: { agent: string; summary: string; changedFiles?: string[] },
    actor: string,
  ): Promise<SessionSummary> {
    const entry = SessionSummarySchema.parse({
      id: randomUUID(),
      agent: input.agent,
      summary: input.summary,
      changedFiles: input.changedFiles ?? [],
      createdAt: new Date().toISOString(),
    }) as SessionSummary;
    await this.appendJsonl(this.paths.sessionHistory, entry);
    const stamped = this.formatSessionEntry(entry);
    const previous = await this.readLatestSession();
    const isFresh = previous.trim() === SESSION_LATEST_MD_TEMPLATE.trim();
    const next = isFresh
      ? `${SESSION_LATEST_MD_TEMPLATE.trim()}\n\n${stamped}\n`
      : `${stamped}\n\n${previous.trim()}\n`;
    await this.writeText(this.paths.latestSession, next);
    await this.audit({ actor, action: 'session-save', target: entry.id, meta: { agent: entry.agent } });
    return entry;
  }

  private formatSessionEntry(entry: SessionSummary): string {
    const files =
      entry.changedFiles.length > 0
        ? entry.changedFiles.map((f) => `  - \`${f}\``).join('\n')
        : '  - (no files reported)';
    return [
      `## ${entry.createdAt} — ${entry.agent}`,
      '',
      entry.summary,
      '',
      '**Changed files:**',
      files,
      '',
      '---',
    ].join('\n');
  }

  /* ------------------------------------------------------------ */
  /* Skills                                                        */
  /* ------------------------------------------------------------ */

  async readSkillIndex(): Promise<SkillIndex> {
    return this.readJson(this.paths.skillsIndex, SkillIndexSchema) as Promise<SkillIndex>;
  }

  async readSkill(name: string): Promise<{ name: string; body: string; path: string }> {
    const safe = this.assertSafeName(name);
    const file = path.join(this.paths.skillsDir, safe, 'SKILL.md');
    const body = await this.readText(file);
    return { name: safe, body, path: path.relative(this.paths.root, file) };
  }

  async createSkill(
    name: string,
    body: string,
    opts: { actor: string; description?: string },
  ): Promise<{ name: string; path: string }> {
    const safe = this.assertSafeName(name);
    const file = path.join(this.paths.skillsDir, safe, 'SKILL.md');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await this.writeText(file, body);
    const index = await this.readSkillIndex();
    const filtered = index.skills.filter((s) => s.name !== safe);
    filtered.push({
      name: safe,
      description: opts.description ?? '',
      path: path.relative(this.paths.skillsDir, file),
    });
    const next = SkillIndexSchema.parse({ schemaVersion: index.schemaVersion, skills: filtered }) as SkillIndex;
    await this.writeJson(this.paths.skillsIndex, next);
    await this.audit({ actor: opts.actor, action: 'skill-create', target: safe });
    return { name: safe, path: path.relative(this.paths.root, file) };
  }

  /* ------------------------------------------------------------ */
  /* Preferences & MCP config                                      */
  /* ------------------------------------------------------------ */

  async readPreferences(): Promise<Preferences> {
    return this.readJson(this.paths.preferences, PreferencesSchema) as Promise<Preferences>;
  }

  async writePreferences(prefs: Preferences, actor: string): Promise<void> {
    const next = PreferencesSchema.parse(prefs) as Preferences;
    await this.writeJson(this.paths.preferences, next);
    await this.audit({ actor, action: 'preferences-write' });
  }

  async readMcpConfig(): Promise<McpConfig> {
    return this.readJson(this.paths.mcpConfig, McpConfigSchema) as Promise<McpConfig>;
  }

  /* ------------------------------------------------------------ */
  /* Audit log                                                     */
  /* ------------------------------------------------------------ */

  async audit(entry: Omit<AuditEntry, 'ts' | 'meta'> & { ts?: string; meta?: Record<string, unknown> }): Promise<void> {
    const full = AuditEntrySchema.parse({
      ts: entry.ts ?? new Date().toISOString(),
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      meta: entry.meta ?? {},
    }) as AuditEntry;
    // Redact string values inside meta for safety.
    const safe: AuditEntry = {
      ...full,
      meta: Object.fromEntries(
        Object.entries(full.meta).map(([k, v]) => [
          k,
          typeof v === 'string' ? redact(v, this.redaction) : v,
        ]),
      ),
    };
    await this.appendJsonl(this.paths.auditLog, safe);
  }

  async readAuditLog(limit = 100): Promise<AuditEntry[]> {
    const all = await this.readJsonl(this.paths.auditLog, AuditEntrySchema);
    return all.slice(-limit);
  }

  /* ------------------------------------------------------------ */
  /* Low-level IO helpers                                          */
  /* ------------------------------------------------------------ */

  private async readJson<S extends z.ZodTypeAny>(file: string, schema: S): Promise<z.output<S>> {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new RepositoryError('read', `File not found: ${file}`);
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new RepositoryError('read', `Invalid JSON in ${file}: ${(err as Error).message}`);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new RepositoryError('read', `Schema mismatch in ${file}: ${result.error.message}`);
    }
    return result.data as z.output<S>;
  }

  private async writeJson(file: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    const json = JSON.stringify(data, null, 2) + '\n';
    await fs.writeFile(tmp, json, 'utf8');
    await fs.rename(tmp, file);
  }

  private async readText(file: string): Promise<string> {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new RepositoryError('read', `File not found: ${file}`);
      }
      throw err;
    }
  }

  /** Write a text file atomically. Public so adapters can render their files. */
  async writeText(file: string, body: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, body, 'utf8');
    await fs.rename(tmp, file);
  }

  private async readJsonl<S extends z.ZodTypeAny>(file: string, schema: S): Promise<z.output<S>[]> {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
    if (!raw.trim()) return [];
    const out: z.output<S>[] = [];
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        throw new RepositoryError('read', `Invalid JSONL in ${file} at line ${i + 1}: ${(err as Error).message}`);
      }
      const r = schema.safeParse(parsed);
      if (!r.success) {
        throw new RepositoryError('read', `Schema mismatch in ${file} at line ${i + 1}: ${r.error.message}`);
      }
      out.push(r.data as z.output<S>);
    }
    return out;
  }

  private async appendJsonl(file: string, entry: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
  }

  private assertSafeName(name: string): string {
    if (!/^[a-z0-9][a-z0-9-_/]*$/.test(name)) {
      throw new RepositoryError(
        'name',
        `Invalid skill name: "${name}". Use lowercase letters, digits, '-' or '_' (and '/' for subpaths).`,
      );
    }
    if (name.includes('..') || name.startsWith('/')) {
      throw new RepositoryError('name', `Unsafe skill name: "${name}"`);
    }
    return name;
  }
}

export class RepositoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RepositoryError';
  }
}
