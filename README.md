# abtest-devExp

**`abctl`**: a developer CLI for an A/B testing platform. Instead of editing variant code in a browser textarea, log in from the terminal, **pull** a variant's JS/CSS to local files, edit in your own editor (linting, git, AI tools), and **push** it back safely with version-conflict detection.

The real platform API isn't available, so the backend is mocked with a local JSON file behind a `PlatformClient` interface. Swapping in a real HTTP API means writing one new client file and changing one line.

## Repo layout

```
abctl/          the CLI, mock platform client, and dummy web dashboard
docs/PLAN.md    original build plan and interview talking points
```

## Features

- `abctl login` / `logout` / `whoami`: scrypt-hashed passwords, masked prompt, session file with mode 0600
- `abctl tests [--client <slug>]`: list tests and variant ids
- `abctl pull <testId> [variantId] [--out <dir>] [--force]`: write `variation.js`, `variation.css` and `.abctl.json`; refuses to overwrite local edits without `--force`
- `abctl push [path] [-m msg] [--dry-run] [--force]`: validates JS (acorn), CSS braces and size limits, then uploads with optimistic concurrency
- Dummy web dashboard (browser textarea editor) on the same mock db, to demo browser-vs-CLI conflicts

## Quick start

Requires Node 20+.

```bash
cd abctl
npm install
npm run build
npm link            # optional: global `abctl` command
```

Without `npm link`, use `node dist/cli.js <args>` or `npm run dev -- <args>`.

## Demo

Terminal 1, the dummy platform:

```bash
abctl seed              # reset mock data (login: dev@demo.com / demo1234)
npm run dashboard       # http://localhost:3000  (set PORT to change)
```

Terminal 2, the CLI:

```bash
abctl login
abctl tests
abctl pull t1 v2        # -> abtests/acme-store/homepage-hero-test/variant-b/
# edit variation.js in your editor
abctl push -m "Bigger CTA" --dry-run
abctl push -m "Bigger CTA"      # v1 -> v2
```

**Conflict:** save the same variant in the dashboard, then `abctl push`. You get exit code 2 and a message such as `Remote is at v3, you pulled v2`. `abctl push --force` overwrites the remote.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | unexpected error |
| 2 | version conflict |
| 3 | auth error |
| 4 | validation error |
| 5 | not found |

## Configuration

| Env var | Purpose | Default |
|---|---|---|
| `ABCTL_HOME` | session directory | `~/.abctl` |
| `ABCTL_DB` | mock database file | `<ABCTL_HOME>/db.json` |
| `PORT` | dashboard port | `3000` |

## Architecture

- Commands only talk to the `PlatformClient` interface ([types.ts](abctl/src/platform/types.ts)). They never read `db.json`.
- [platform/index.ts](abctl/src/platform/index.ts) is the single place that chooses the backend. A real HTTP client would implement the same interface.
- Optimistic concurrency: `push` sends the version you pulled. If the remote has moved on, it is rejected. A real backend would enforce this in SQL: `UPDATE ... WHERE version = $base`.
- Typed errors ([errors.ts](abctl/src/errors.ts)) are mapped to exit codes by one global handler in [cli.ts](abctl/src/cli.ts).
- Mock db writes are atomic (temp file, then rename).

## Status

Phases 0-3 are complete: the CLI, mock backend, conflict detection and dashboard all work. Still to do: unit and integration tests (the suite currently holds only a placeholder smoke test) and a rehearsed demo pass. See [docs/PLAN.md](docs/PLAN.md).
