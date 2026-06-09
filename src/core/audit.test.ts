import { describe, it, expect } from 'vitest';
import { redact } from './audit.js';

const ENABLED = { enabled: true, patterns: [] };

describe('redact', () => {
  it('redacts OpenAI keys', () => {
    const input = 'use this key sk-proj-abcdefghijklmnopqrstuv and continue';
    const out = redact(input, ENABLED);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sk-proj-abcdefghijklmnopqrstuv');
  });

  it('redacts GitHub tokens', () => {
    const out = redact('token ghp_abcdefghijklmnopqrstuvwx', ENABLED);
    expect(out).toContain('[REDACTED]');
  });

  it('redacts AWS access key ids', () => {
    const out = redact('key=AKIAIOSFODNN7EXAMPLE', ENABLED);
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Google API keys', () => {
    const out = redact('AIzaSyAbcdefghijklmnopqrstuvwxyz1234', ENABLED);
    expect(out).toContain('[REDACTED]');
  });

  it('passes through when disabled', () => {
    const input = 'sk-proj-abcdefghijklmnopqrstuv';
    expect(redact(input, { enabled: false, patterns: [] })).toBe(input);
  });

  it('ignores invalid patterns instead of crashing', () => {
    const out = redact('hello world', { enabled: true, patterns: ['[invalid('] });
    expect(out).toBe('hello world');
  });

  it('returns input unchanged when no config and not enabled', () => {
    expect(redact('sk-proj-abcdefghijklmnopqrstuv')).toBe('sk-proj-abcdefghijklmnopqrstuv');
  });
});
