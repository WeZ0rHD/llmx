/**
 * Default content for the various LLMX files. Kept in one place so the
 * `init` command and the adapters stay in sync.
 */

export const AGENTS_MD_TEMPLATE = `# Shared Agent Context

This project uses **LLMX** to share context between AI coding agents.

Before starting work:
1. Read \`project.llmx/memory/project-state.md\`
2. Read \`project.llmx/memory/tasks.json\`
3. Read \`project.llmx/memory/decisions.jsonl\`
4. Read \`project.llmx/sessions/latest.md\`
5. Read \`project.llmx/skills/index.json\`

During work:
- Keep decisions explicit. Add them to \`project.llmx/memory/decisions.jsonl\`.
- Do not duplicate existing architecture. Check \`project-state.md\` first.
- Update tasks in \`project.llmx/memory/tasks.json\` when status changes.
- Use relevant skills from \`project.llmx/skills/\` when available.

After work:
1. Update \`project.llmx/sessions/latest.md\` with a concise summary.
2. Add important decisions to \`project.llmx/memory/decisions.jsonl\`.
3. Update \`project.llmx/memory/tasks.json\`.
4. Mention changed files and why.

> One memory. Every agent.
`;

export const CLAUDE_MD_TEMPLATE = `# Claude Code Instructions

This project uses **LLMX** for shared AI agent context.

Always read before working:
- \`project.llmx/memory/project-state.md\`
- \`project.llmx/memory/tasks.json\`
- \`project.llmx/memory/decisions.jsonl\`
- \`project.llmx/sessions/latest.md\`
- \`project.llmx/skills/index.json\`

After work, keep the shared context in sync:
- Update \`project.llmx/sessions/latest.md\` with what you did and why.
- Add important decisions to \`project.llmx/memory/decisions.jsonl\`.
- Update \`project.llmx/memory/tasks.json\` (move tasks to \`done\` / \`in_progress\`).
- Keep summaries concise and useful — short bullets beat long prose.

Rules:
- Never read or echo \`.env\` files or other secret material into shared context.
- Prefer adding a decision entry over free-form prose for important choices.
`;

export const PROJECT_STATE_MD_TEMPLATE = `# Project State

> High-level snapshot of the project. Update this file when goals, scope or
> architecture change. Keep it short — bullets, not essays.

## Goals

-

## Non-goals

-

## Architecture (one-liner)

-

## Tech stack

-

## Open questions

-

## Links

- LLMX spec: \`specs/llmx-v0.1.md\`
- Shared context: \`project.llmx/\`
`;

export const SESSION_LATEST_MD_TEMPLATE = `# Latest session summary

> Updated by \`llmx session save\`. The most recent summary appears first.

`;

export const PREFERENCES_DEFAULT = {
  schemaVersion: 1,
  preferences: {
    style: 'concise',
    language: 'en',
  },
};

export const TASK_LIST_DEFAULT = {
  schemaVersion: 1,
  tasks: [],
};

export const SKILL_INDEX_DEFAULT = {
  schemaVersion: 1,
  skills: [],
};

export const DEFAULT_AGENT_CONFIG = {
  name: 'default',
  description: 'Default agent preferences applied to any LLMX-aware agent.',
  preferences: {
    style: 'concise',
  },
};

export const DEFAULT_MCP_CONFIG = {
  schemaVersion: 1,
  localOnly: true,
  autoExecShell: false,
  readEnvFiles: false,
  redaction: {
    enabled: true,
    patterns: [
      'sk-[A-Za-z0-9-_]{16,}',
      'sk_live_[A-Za-z0-9]{16,}',
      'sk_test_[A-Za-z0-9]{16,}',
      'ghp_[A-Za-z0-9]{16,}',
      'gho_[A-Za-z0-9]{16,}',
      'xox[baprs]-[A-Za-z0-9-]{10,}',
      'AIza[0-9A-Za-z_-]{16,}',
      'AKIA[0-9A-Z]{16}',
      '-----BEGIN [A-Z ]+PRIVATE KEY-----',
    ],
  },
  servers: [],
};

export const EXAMPLE_SKILL_NAME = 'triage-bug';
export const EXAMPLE_SKILL_MD = `# Triage Bug

When the user reports a bug, do the following:

1. Reproduce minimally.
2. Identify the failing file/function.
3. Propose a fix and a regression test.
4. Add a task to \`project.llmx/memory/tasks.json\` describing the fix.

Keep the diagnosis short.
`;
