import { Command } from "commander";
import pc from "picocolors";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { push } from "./commands/push.js";
import { pull } from "./commands/pull.js";
import { seed } from "./commands/seed.js";
import { tests } from "./commands/tests.js";
import { whoami } from "./commands/whoami.js";
import { AbctlError } from "./errors.js";

const program = new Command();

program
  .name("abctl")
  .description("Developer CLI for an A/B testing platform")
  .version("0.1.0")
  .option("--debug", "show stack traces on errors");

program
  .command("login")
  .description("Log in to the platform")
  .option("--email <email>", "email address")
  .option("--password-stdin", "read the password from stdin")
  .action(login);

program.command("logout").description("Delete the local session").action(logout);
program.command("whoami").description("Show the logged-in user").action(whoami);
program
  .command("tests")
  .description("List tests and their variant ids")
  .option("--client <slug>", "only show tests for this client")
  .action(tests);

program
  .command("pull <testId> [variantId]")
  .description("Download variant code to local files")
  .option("--out <dir>", "output directory", "abtests")
  .option("--force", "overwrite local changes")
  .action(pull);

program
  .command("push [path]")
  .description("Validate and upload local edits")
  .option("-m, --message <message>", "history message")
  .option("--dry-run", "show what would change without pushing")
  .option("--force", "overwrite the remote even if it changed since you pulled")
  .action(push);

program.command("seed", { hidden: true }).description("Reset mock data").action(seed);

program.parseAsync(process.argv).catch((err: unknown) => {
  const debug = program.opts().debug === true;
  if (err instanceof AbctlError) {
    console.error(`${pc.red("Error:")} ${err.message}`);
    if (debug) console.error(err.stack);
    process.exit(err.exitCode);
  }
  // Ctrl+C at a prompt
  if (err instanceof Error && err.name === "ExitPromptError") process.exit(130);
  console.error(`${pc.red("Error:")} ${err instanceof Error ? err.message : String(err)}`);
  if (debug && err instanceof Error) console.error(err.stack);
  process.exit(1);
});
