import { Command } from "commander";

const program = new Command();

program
  .name("abctl")
  .description("Developer CLI for an A/B testing platform")
  .version("0.1.0")
  .option("--debug", "show stack traces on errors");

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
