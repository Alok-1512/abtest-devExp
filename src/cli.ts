import { Command } from "commander";
import pc from "picocolors";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { seed } from "./commands/seed.js";
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
