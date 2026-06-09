#!/usr/bin/env node
/**
 * `llmx` CLI entry point. Builds the commander program and dispatches.
 */
import { run } from './program.js';

run(process.argv).catch((err) => {
  // Commander's own errors (help, version, parse errors) already carry the
  // right exit code and message. Let them through cleanly.
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('commander.')) {
    process.exit(typeof err.exitCode === 'number' ? err.exitCode : 1);
  }
  // eslint-disable-next-line no-console
  console.error(`llmx: unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
