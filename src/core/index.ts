/**
 * Core domain types and repository.
 *
 * The "Repository" is a thin object that reads/writes a `project.llmx/`
 * directory on the local filesystem. It is the single point of access for
 * all LLMX data — CLI commands, adapters and the MCP server all go through
 * it.
 */
export * from './schema.js';
export * from './repository.js';
export * from './paths.js';
export * from './audit.js';
export * from './defaults.js';
