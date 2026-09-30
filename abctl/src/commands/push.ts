import path from "node:path";
import pc from "picocolors";
import { ValidationError } from "../errors.js";
import { getClient } from "../platform/index.js";
import { requireSession } from "../session.js";
import { validateCode } from "../validate.js";
import { contentHash, readCode, readMeta, writeMeta } from "../workspace.js";

const lines = (s: string) => (s === "" ? 0 : s.split("\n").length - (s.endsWith("\n") ? 1 : 0));
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export async function push(
  dirArg: string | undefined,
  opts: { message?: string; dryRun?: boolean; force?: boolean },
): Promise<void> {
  const { token } = requireSession();

  const dir = path.resolve(dirArg ?? ".");
  const meta = readMeta(dir);
  if (!meta) {
    throw new ValidationError(`No .abctl.json in ${dir}. Run this inside a pulled variant folder.`);
  }
  const { js, css } = readCode(dir);
  validateCode(js, css);

  const hash = contentHash(js, css);
  if (hash === meta.contentHash) {
    console.log("Nothing to push.");
    return;
  }

  const client = getClient();

  if (opts.dryRun) {
    const remote = await client.getVariant(token, meta.testId, meta.variantId);
    console.log(pc.bold(`Dry run: ${meta.testId}/${meta.variantId} (pulled v${meta.baseVersion})`));
    console.log(`  JS   ${remote.js.length} -> ${js.length} bytes, ${signed(lines(js) - lines(remote.js))} lines`);
    console.log(`  CSS  ${remote.css.length} -> ${css.length} bytes, ${signed(lines(css) - lines(remote.css))} lines`);
    if (remote.version !== meta.baseVersion) {
      console.log(pc.yellow(`  Note: remote is at v${remote.version}; a real push would conflict.`));
    }
    console.log("No changes were made.");
    return;
  }

  const updated = await client.pushVariant(token, {
    testId: meta.testId,
    variantId: meta.variantId,
    js,
    css,
    baseVersion: meta.baseVersion,
    message: opts.message,
    force: opts.force,
  });

  writeMeta(dir, {
    ...meta,
    baseVersion: updated.version,
    contentHash: hash,
    pulledAt: new Date().toISOString(),
  });
  console.log(`${pc.green("✔")} Pushed v${meta.baseVersion} -> v${updated.version}`);
}
