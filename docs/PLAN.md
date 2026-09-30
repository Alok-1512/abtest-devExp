# abctl: Developer CLI for an A/B Testing Platform

> Hand this file to Claude Code. Time budget: **90 minutes total**. Ship a working vertical slice first, polish second.

## 1. Context

I'm interviewing for a full-stack developer role (1-3 yrs experience) at a company that runs an A/B testing platform. As part of the interview I'm showing a small feature I built on top of the existing product idea.

The existing product has a small dashboard where a user can create an A/B test and update the code (JS/CSS) for a variant. That is the only working thing.

**The feature:** a CLI (`abctl`) that improves developer experience. Instead of editing variant code in a browser textarea, a developer can log in from the terminal, **pull** a variant's code to local files, edit it in their own editor (with linting, git, AI tools), and **push** it back safely.

I have **no access to the real platform API**, so the backend is mocked with a local JSON file. The code must be structured so swapping the mock for a real HTTP API is a one-file change. That design point is a key interview talking point.

## 2. Goals and non-goals

**Goals (must ship):**
1. `abctl login` / `logout` / `whoami`: authenticate against the mock backend, persist a session locally.
2. `abctl pull`: download a variant's JS and CSS into local files.
3. `abctl push`: validate and upload local edits, with **version conflict detection**.
4. A tiny `abctl tests` list command so a developer can discover test and variant IDs (needed to make pull usable).
5. Unit and integration tests on the important paths.
6. A README with a 2-minute demo script.

**Non-goals (do NOT build unless everything above is done and time remains):**
- Real network calls, real OAuth, a database, a web UI changes, client/test creation commands, watch mode, npm publishing.

**Stretch, in this order, only if time remains:** `abctl diff`, `abctl push --watch`, `abctl history <variant>`.

## 3. Tech decisions (already made, don't relitigate)

- **Language:** Node 20+ with **TypeScript**, ESM. One language only.
- **CLI framework:** `commander`
- **Prompts:** `@inquirer/prompts` (password input must be masked)
- **Validation:** `zod` for the db.json and meta file schemas; `acorn` to syntax-check pushed JS
- **Output:** `picocolors` (or chalk) and `ora` for spinners; keep output clean
- **Tests:** `vitest`
- **Build/run:** `tsx` for dev, `tsup` to build to `dist/`; `bin` entry so `npm link` gives a global `abctl`
- **Crypto:** Node built-in `crypto` (`scrypt` for password hashes, `randomBytes` for tokens). No extra auth libs.

## 4. Architecture

```
src/
  cli.ts                 # commander setup, wires commands, global error handler -> exit codes
  commands/
    login.ts logout.ts whoami.ts tests.ts pull.ts push.ts seed.ts(hidden dev cmd)
  platform/
    types.ts             # PlatformClient interface + domain types (Client, Test, Variant, User)
    localJsonClient.ts   # implements PlatformClient against db.json  <-- the mock
    # httpClient.ts      # (NOT built) would implement the same interface against the real API
  session.ts             # read/write ~/.abctl/session.json (chmod 600), expiry check
  workspace.ts           # pull layout: write/read variation files + .abctl.json metadata
  validate.ts            # JS syntax check (acorn), size limits, CSS sanity
  errors.ts              # typed errors: AuthError, ConflictError, ValidationError, NotFoundError
  paths.ts               # resolves ABCTL_HOME and ABCTL_DB env overrides (critical for tests)
tests/
```

**Key rule:** commands only talk to `PlatformClient`. They never read `db.json` directly. This is the seam that makes the mock swappable.

### PlatformClient interface (sketch)

```ts
interface PlatformClient {
  login(email: string, password: string): Promise<{ token: string; user: User; expiresAt: string }>;
  whoami(token: string): Promise<User>;
  listTests(token: string, opts?: { clientId?: string }): Promise<TestSummary[]>;
  getVariant(token: string, testId: string, variantId: string): Promise<Variant>;
  pushVariant(token: string, input: {
    testId: string; variantId: string;
    js: string; css: string;
    baseVersion: number;      // the version the developer pulled
    message?: string;
    force?: boolean;
  }): Promise<Variant>;       // throws ConflictError if server version != baseVersion and !force
}
```

### Mock data model (`db.json`)

```json
{
  "users":   [{ "id": "u1", "email": "dev@demo.com", "passwordHash": "scrypt$salt$hash", "role": "developer" }],
  "sessions":[{ "token": "hex", "userId": "u1", "expiresAt": "ISO" }],
  "clients": [{ "id": "c1", "name": "Acme Store", "slug": "acme-store", "domain": "acme.com" }],
  "tests":   [{
    "id": "t1", "clientId": "c1", "name": "Homepage Hero Test", "slug": "homepage-hero-test", "status": "running",
    "variants": [{
      "id": "v1", "name": "Control", "trafficPct": 50, "js": "", "css": "", "version": 1,
      "updatedAt": "ISO", "updatedBy": "u1",
      "history": [{ "version": 1, "at": "ISO", "by": "u1", "message": "initial" }]
    }]
  }]
}
```

Seed data: 1 user (`dev@demo.com` / `demo1234`), 2 clients, 3 tests, 2 variants each, with realistic small JS/CSS (e.g. change a CTA button text, hide a banner). Passwords hashed with scrypt, never plaintext in seed output.

## 5. Command spec

### `abctl login`
- Prompts for email and masked password (also accepts `--email` and `--password-stdin` for scripting).
- Calls `client.login`. On success writes `~/.abctl/session.json` with `{ token, email, expiresAt }` and file mode `0600`.
- Wrong credentials -> `AuthError`, exit code 3, message does not reveal whether the email exists.

### `abctl logout` / `abctl whoami`
- logout deletes the session file. whoami prints email and role, or "Not logged in" / "Session expired".

### `abctl tests [--client <slug>]`
- Table: client, test name, test id, variant ids and names, status, current version per variant.

### `abctl pull <testId> [variantId] [--out <dir>] [--force]`
- No variantId = pull all variants of the test.
- Writes to `<out or ./abtests>/<client-slug>/<test-slug>/<variant-name-slug>/`:
  - `variation.js`
  - `variation.css`
  - `.abctl.json` -> `{ testId, variantId, baseVersion, contentHash, pulledAt }`
- If the target dir has local modifications (hash differs from meta.contentHash), refuse to overwrite unless `--force`.

### `abctl push [path] [-m "message"] [--dry-run] [--force]`
- `path` defaults to the current directory; must contain `.abctl.json`.
- Steps, in order:
  1. Require valid session (else exit 3).
  2. Read meta and files; zod-validate meta.
  3. **Validate**: JS parses with acorn (report line/column on error); JS and CSS each <= 100 KB; reject if both empty.
  4. If content hash equals meta.contentHash -> print "Nothing to push", exit 0.
  5. `--dry-run`: print what would change (sizes, line count delta) and stop.
  6. Call `pushVariant` with `baseVersion`. Server side (mock) compares versions:
     - equal -> save, `version += 1`, append history entry, return new version.
     - different and not `--force` -> `ConflictError`, exit code 2, message: "Remote is at v4, you pulled v2. Run `abctl pull ... --force` to refresh, or push with --force to overwrite."
  7. On success update `.abctl.json` with the new baseVersion and hash.

### Exit codes
`0` ok · `1` unexpected · `2` conflict · `3` auth · `4` validation · `5` not found

## 6. Engineering requirements

- **Atomic writes** for db.json: write to a temp file in the same dir, then `rename`. Prevents corruption on crash.
- **Concurrency safety (simple):** in the mock, do read-modify-write inside one function; add a comment noting a real backend would use a DB transaction or `UPDATE ... WHERE version = $base`.
- **Testability:** every path is overridable via `ABCTL_HOME` (session dir) and `ABCTL_DB` (db file). Tests use temp dirs; never touch the real home directory.
- **Errors:** a single global handler in `cli.ts` maps typed errors to exit codes and friendly messages. No stack traces unless `--debug`.
- **Security basics:** masked password input, session file 0600, no secrets in logs, constant-time compare for password hashes (`timingSafeEqual`).
- **No over-engineering:** no DI framework, no classes where a function works, no premature abstractions beyond `PlatformClient`.

## 7. Build phases (commit after each phase; run tests before committing)

| Phase | Time | Deliverable | Done when |
|---|---|---|---|
| 0 | 0-10 min | Scaffold: package.json, tsconfig, tsup, vitest, `bin`, `abctl --help` works, `CLAUDE.md`, git init | `npm run build && node dist/cli.js --help` works |
| 1 | 10-30 min | `platform/types`, `localJsonClient`, seed, session, login/logout/whoami | Can log in with seeded user, wrong password fails with exit 3, session file is 0600 |
| 2 | 30-50 min | `tests`, `pull`, workspace layout | Pulled files + `.abctl.json` appear correctly; re-pull with local edits is refused without `--force` |
| 3 | 50-70 min | `push`, validation, dry-run, version bump, history, **conflict detection** | Two-clone conflict scenario yields exit 2; syntax error yields exit 4 with line number |
| 4 | 70-85 min | Tests for auth, pull, push, conflict, validation, atomic write | `npm test` green |
| 5 | 85-90 min | README with demo script, `npm link` verified | Demo script runs top to bottom without errors |

**Instruction to Claude Code:** work one phase at a time. After each phase, run the build and tests, show me the result, and stop for my go-ahead. If a phase overruns its time box, cut scope inside that phase rather than skipping later phases.

## 8. Suggested `CLAUDE.md` for the repo

```md
# abctl
Node 20 + TypeScript (ESM) CLI. Mock backend in src/platform/localJsonClient.ts.
- Commands must only use the PlatformClient interface, never read db.json directly.
- All paths go through src/paths.ts (ABCTL_HOME, ABCTL_DB) so tests are hermetic.
- Errors are typed (src/errors.ts) and mapped to exit codes in cli.ts.
- Run: npm run dev -- <args> | npm run build | npm test
- Keep it small. No new dependencies without asking.
```

## 9. Demo script (put in README, rehearse it)

```bash
abctl seed                          # reset mock data
abctl login                         # dev@demo.com / demo1234
abctl tests                         # find a test + variant
abctl pull t1 v2                    # files land locally
code abtests/acme-store/homepage-hero-test/variant-b/variation.js   # edit in real editor
abctl push -m "Bigger CTA" --dry-run
abctl push -m "Bigger CTA"          # v2 -> v3
# simulate a teammate: in a 2nd folder, pull earlier and push first, then push here:
abctl push                          # -> conflict, exit 2, clear message
```

## 10. Interview talking points this feature supports

- **Why a CLI:** devs live in their editor; pulling code enables git history, linting, code review, and AI assistants on variant code.
- **Interface seam:** mock and real backend share `PlatformClient`; moving to HTTP is one new file.
- **Optimistic concurrency:** version check on push (same idea as ETags / `If-Match`); real backend would enforce it in SQL.
- **Production next steps:** OAuth device-code login instead of password prompt, API tokens with scopes, `--watch`, CI usage (`abctl push` in a pipeline), preview URL for a variant, and `abctl diff`.
- **Built with AI:** I specified the architecture and constraints, worked in reviewed phases, and verified with tests. I can explain every file.

## 11. Assumptions (correct before building if wrong)

1. Variant code is one JS file and one CSS file per variant.
2. Tests belong to clients; variants belong to tests.
3. A single seeded developer account is enough for the demo.
