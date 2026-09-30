import { input, password as passwordPrompt } from "@inquirer/prompts";
import pc from "picocolors";
import { getClient } from "../platform/index.js";
import { writeSession } from "../session.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

export async function login(opts: { email?: string; passwordStdin?: boolean }): Promise<void> {
  const email = opts.email ?? (await input({ message: "Email:" }));
  const password = opts.passwordStdin
    ? await readStdin()
    : await passwordPrompt({ message: "Password:", mask: "*" });

  const result = await getClient().login(email, password);
  writeSession({ token: result.token, email: result.user.email, expiresAt: result.expiresAt });
  console.log(`${pc.green("✔")} Logged in as ${result.user.email}`);
}
