# abctl

Node 20+ / TypeScript CLI for an A/B testing platform (mock backend).

## Setup
```bash
npm install
npm run build
npm link            # optional: global `abctl` command
```
Without `npm link`, use `node dist/cli.js <args>` or `npm run dev -- <args>`.

## Dummy platform (browser dashboard)
```bash
abctl seed          # reset mock data (dev@demo.com / demo1234)
npm run dashboard   # http://localhost:3000  (PORT to change)
```

## Demo
```bash
abctl login
abctl tests
abctl pull t1 v2
# edit abtests/acme-store/homepage-hero-test/variant-b/variation.js
abctl push -m "Bigger CTA" --dry-run
abctl push -m "Bigger CTA"
```
Conflict: save the same variant in the dashboard, then `abctl push` -> exit 2. `--force` overwrites.

## Exit codes
0 ok · 1 unexpected · 2 conflict · 3 auth · 4 validation · 5 not found

## Env overrides
`ABCTL_HOME` (session dir, default `~/.abctl`) and `ABCTL_DB` (mock db file).
