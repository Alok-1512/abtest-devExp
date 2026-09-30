import path from "node:path";
import pc from "picocolors";
import { ValidationError } from "../errors.js";
import { getClient } from "../platform/index.js";
import { requireSession } from "../session.js";
import { hasLocalChanges, variantDir, writeVariantFiles } from "../workspace.js";

export async function pull(
  testId: string,
  variantId: string | undefined,
  opts: { out?: string; force?: boolean },
): Promise<void> {
  const { token } = requireSession();
  const test = await getClient().getTest(token, testId);
  const root = path.resolve(opts.out ?? "abtests");

  const variants = variantId ? [await getClient().getVariant(token, testId, variantId)] : test.variants;
  const targets = variants.map((v) => ({ v, dir: variantDir(root, test.clientSlug, test.slug, v.name) }));

  // Check everything first so a refusal doesn't leave a half-pulled test.
  if (!opts.force) {
    const dirty = targets.filter((t) => hasLocalChanges(t.dir));
    if (dirty.length > 0) {
      const list = dirty.map((t) => `  ${path.relative(process.cwd(), t.dir)}`).join("\n");
      throw new ValidationError(
        `Local changes would be overwritten:\n${list}\nPush them, or re-run with --force to discard.`,
      );
    }
  }

  for (const { v, dir } of targets) {
    writeVariantFiles(dir, v, { testId, variantId: v.id });
    console.log(`${pc.green("✔")} ${v.name} (v${v.version}) -> ${path.relative(process.cwd(), dir)}`);
  }
}
