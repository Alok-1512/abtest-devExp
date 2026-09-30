# abctl
Node 20 + TypeScript (ESM) CLI. Mock backend in src/platform/localJsonClient.ts.
- Commands must only use the PlatformClient interface, never read db.json directly.
- All paths go through src/paths.ts (ABCTL_HOME, ABCTL_DB) so tests are hermetic.
- Errors are typed (src/errors.ts) and mapped to exit codes in cli.ts.
- Run: npm run dev -- <args> | npm run build | npm test
- Keep it small. No new dependencies without asking.
