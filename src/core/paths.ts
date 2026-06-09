/**
 * Path helpers for a `project.llmx/` directory.
 *
 * The on-disk layout is intentionally flat and human-readable. All paths are
 * relative to the root directory of the LLMX project.
 */
import path from 'node:path';

export const LLMX_DIR_NAME = 'project.llmx';

export interface LlmxPaths {
  root: string;
  manifest: string;
  memoryDir: string;
  projectState: string;
  decisions: string;
  tasks: string;
  preferences: string;
  sessionsDir: string;
  latestSession: string;
  sessionHistory: string;
  skillsDir: string;
  skillsIndex: string;
  agentsDir: string;
  defaultAgent: string;
  toolsDir: string;
  mcpConfig: string;
  logsDir: string;
  auditLog: string;
  agentsFile: string; // top-level AGENTS.md (sibling of project.llmx/)
  claudeFile: string; // top-level CLAUDE.md (sibling of project.llmx/)
}

export function resolvePaths(projectRoot: string): LlmxPaths {
  const root = path.join(projectRoot, LLMX_DIR_NAME);
  return {
    root,
    manifest: path.join(root, 'manifest.json'),
    memoryDir: path.join(root, 'memory'),
    projectState: path.join(root, 'memory', 'project-state.md'),
    decisions: path.join(root, 'memory', 'decisions.jsonl'),
    tasks: path.join(root, 'memory', 'tasks.json'),
    preferences: path.join(root, 'memory', 'preferences.json'),
    sessionsDir: path.join(root, 'sessions'),
    latestSession: path.join(root, 'sessions', 'latest.md'),
    sessionHistory: path.join(root, 'sessions', 'history.jsonl'),
    skillsDir: path.join(root, 'skills'),
    skillsIndex: path.join(root, 'skills', 'index.json'),
    agentsDir: path.join(root, 'agents'),
    defaultAgent: path.join(root, 'agents', 'default.json'),
    toolsDir: path.join(root, 'tools'),
    mcpConfig: path.join(root, 'tools', 'mcp.json'),
    logsDir: path.join(root, 'logs'),
    auditLog: path.join(root, 'logs', 'audit.jsonl'),
    agentsFile: path.join(projectRoot, 'AGENTS.md'),
    claudeFile: path.join(projectRoot, 'CLAUDE.md'),
  };
}
