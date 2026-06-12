/**
 * Path helpers for the personal `~/.llmx/studio/` directory.
 *
 * Studio is a per-user workspace (not per-project). It lives under
 * `$HOME/.llmx/studio/` by default and is overridable with the
 * `LLMX_STUDIO_DIR` env var.
 *
 * The on-disk layout is intentionally flat and human-readable — same
 * principles as `project.llmx/`.
 */
import path from 'node:path';
import os from 'node:os';

export const STUDIO_DIR_NAME = 'studio';

export function resolveStudioRoot(): string {
  const override = process.env.LLMX_STUDIO_DIR;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), '.llmx', STUDIO_DIR_NAME);
}

export interface StudioPaths {
  root: string;
  manifest: string;
  inboxDir: string;
  classifiedDir: string;
  synthesesDir: string;
  draftsDir: string;
  publishedDir: string;
  tagsDir: string;
  logsDir: string;
  auditLog: string;
}

export function resolveStudioPaths(root: string = resolveStudioRoot()): StudioPaths {
  return {
    root,
    manifest: path.join(root, 'manifest.json'),
    inboxDir: path.join(root, 'inbox'),
    classifiedDir: path.join(root, 'classified'),
    synthesesDir: path.join(root, 'syntheses'),
    draftsDir: path.join(root, 'drafts'),
    publishedDir: path.join(root, 'published'),
    tagsDir: path.join(root, 'classified', 'by-tag'),
    logsDir: path.join(root, 'logs'),
    auditLog: path.join(root, 'logs', 'audit.jsonl'),
  };
}
