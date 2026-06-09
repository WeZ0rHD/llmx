/**
 * CLI helpers shared by all subcommands.
 */
import { Repository } from '../core/index.js';

export const ACTOR = 'llmx-cli';

export interface CommandContext {
  repo: Repository;
}

export function openRepo(projectRoot: string): Repository {
  return new Repository({ projectRoot });
}

export async function requireRepo(projectRoot: string): Promise<Repository> {
  const repo = openRepo(projectRoot);
  if (!(await repo.exists())) {
    throw new FriendlyError(`No LLMX project found at ${repo.paths.root}. Run \`llmx init\` first.`);
  }
  return repo;
}

export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendlyError';
  }
}

export function printOk(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`✅ ${msg}`);
}

export function printInfo(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

export function printWarn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`⚠️  ${msg}`);
}

export function printErr(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`❌ ${msg}`);
  process.exit(1);
}

export function truncate(s: string, max = 80): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}
