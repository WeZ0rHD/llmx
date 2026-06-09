# LLMX — Security

> Local-first, secure by default.

## Threat model (v0)

LLMX is a **local** tool. Its only network surface is whatever the user
explicitly enables (none in v0). The realistic threats are:

1. **Secret leakage** — accidentally copying a `.env` value, an API key,
   or a private key into the shared context.
2. **Path traversal** — malicious or accidental names like `../../etc/passwd`
   when writing skills.
3. **Shell execution by agents** — a careless agent reading a "decision"
   that contains an executable instruction.
4. **Tampering** — local-only is not tamper-proof; we treat the audit
   log as the source of truth for *who did what*, not as access control.

## Defaults that protect you

| Setting (in `tools/mcp.json`) | Default |
| --- | --- |
| `localOnly` | `true` |
| `autoExecShell` | `false` |
| `readEnvFiles` | `false` |
| `redaction.enabled` | `true` |

`llmx init` writes these defaults. **Do not** flip `localOnly` or
`autoExecShell` to `true` unless you really mean it.

## What we redact in audit logs

`audit.jsonl` entries go through `redact()` before being written. The
built-in patterns cover:

- OpenAI keys (`sk-...`, `sk_live_...`, `sk_test_...`)
- GitHub tokens (`ghp_...`, `gho_...`)
- Google API keys (`AIza...`)
- AWS access key IDs (`AKIA...`)
- Slack tokens (`xox[abprs]-...`)
- PEM private key headers

You can add patterns in `tools/mcp.json → redaction.patterns`.

## What we never read

- `.env` and any file matching `*.env`, `*.pem`, `*.key` — by default
  the LLMX CLI does not open them. Agents are explicitly told in
  `CLAUDE.md` / `AGENTS.md` not to echo secrets into shared context.
- We never run `exec` or `spawn` from the CLI. Period.

## When the MCP server lands

- It will refuse to start if `localOnly` is `false` *and* `autoExecShell`
  is `true`, unless `--danger-allow-remote-exec` is passed.
- All tool calls go through the same audit log.
- Skill reads are name-validated: only `^[a-z0-9][a-z0-9-_/]*$` allowed;
  `..` and absolute paths are rejected.

## Reporting issues

Security issues can be reported by opening a private issue or emailing
the maintainers (see `README.md`). Please do not file public issues for
anything that could compromise a user.
