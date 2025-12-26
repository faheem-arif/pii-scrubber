# Local-First PII + Secret Scrubber

Scrub sensitive data entirely in your browser. No uploads, no telemetry, no analytics.

Live site: https://faheem-arif.github.io/pii-scrubber/

## Setup Guide

1) Install deps: `pnpm install`
2) Run the web app: `pnpm --filter @pii-scrubber/web dev`
3) Paste text or drop a .txt/.log/.json file
4) Pick a mode (redact, token-map, hash) and click **Scrub**
5) Download the scrubbed output and `report.json` (and `mapping.jsonl` if using token-map)

## Privacy promise

- All detection and scrubbing happens locally in your browser.
- No network calls, telemetry, or analytics are used or shipped.
- The core engine is a pure TypeScript library (browser-safe).

## Features (v1)

- Deterministic detectors: email, IPv4/IPv6, UUID, URL basic auth, JWT, PEM private keys, GitHub tokens, AWS access keys, and high-entropy secrets.
- Scrub modes:
  - `redact`: irreversible (`[EMAIL_REDACTED]`)
  - `token-map`: stable tokens per run with `mapping.jsonl`
  - `hash`: salted SHA-256 (`TYPE_SHA256:<digest>`)
- Web Worker execution keeps UI responsive.
- Summary badges + report download.
- Diff toggle for quick review.
- File size warning > 5MB; hard cap at 25MB in v1.

## Security guidance (token-map)

`mapping.jsonl` contains the original sensitive values. Treat it like a secret:
- Store it securely (encrypted at rest if possible).
- Do not share unless absolutely necessary.
- If you must share, encrypt the file before sending.

## Limitations (v1)

- No OCR or document/image processing.
- No name/address detection; limited to deterministic patterns listed above.
- No cloud backend, accounts, or persistence.
- Large files are capped at 25MB in the UI.

## Repo layout

- `packages/core`: Scrubber engine (pure TypeScript)
- `apps/web`: Next.js UI (static export)
- `fixtures`: Shared fixtures for core tests
- `.github/workflows/ci.yml`: CI pipeline

## Commands

- Dev server: `pnpm --filter @pii-scrubber/web dev`
- Tests: `pnpm -w test`
- Build: `pnpm -w build`

## Build notes

The web app uses Next.js static export (`output: "export"`) and runs entirely client-side.

## License

MIT
