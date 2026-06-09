/**
 * Tiny redaction helper for the audit log.
 *
 * Patterns are loaded from the MCP config. We keep this deliberately small:
 * regex-based, sync, with no allocation per match beyond the replacement
 * string. The point is to make sure obvious secrets don't leak into the
 * shared context — not to be a comprehensive DLP system.
 */
export interface RedactionConfig {
  enabled: boolean;
  patterns: string[];
}

const DEFAULT_PATTERNS: string[] = [
  'sk-[A-Za-z0-9-_]{16,}',
  'sk_live_[A-Za-z0-9]{16,}',
  'sk_test_[A-Za-z0-9]{16,}',
  'ghp_[A-Za-z0-9]{16,}',
  'gho_[A-Za-z0-9]{16,}',
  'xox[baprs]-[A-Za-z0-9-]{10,}',
  'AIza[0-9A-Za-z_-]{16,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN [A-Z ]+PRIVATE KEY-----',
];

export function redact(input: string, cfg?: RedactionConfig): string {
  if (!cfg || !cfg.enabled) return input;
  const patterns = cfg.patterns.length > 0 ? cfg.patterns : DEFAULT_PATTERNS;
  let out = input;
  for (const p of patterns) {
    try {
      const re = new RegExp(p, 'g');
      out = out.replace(re, '[REDACTED]');
    } catch {
      // Ignore invalid user-provided patterns; the rest of the redaction still runs.
    }
  }
  return out;
}

export function redactValue<T>(value: T, cfg?: RedactionConfig): T {
  if (!cfg || !cfg.enabled) return value;
  if (typeof value === 'string') return redact(value, cfg) as unknown as T;
  return value;
}
