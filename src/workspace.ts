import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ValidationError } from "./errors.js";

export const META_FILE = ".abctl.json";
export const JS_FILE = "variation.js";
export const CSS_FILE = "variation.css";

const metaSchema = z.object({
  testId: z.string(),
  variantId: z.string(),
  baseVersion: z.number().int(),
  contentHash: z.string(),
  pulledAt: z.string(),
});

export type Meta = z.infer<typeof metaSchema>;

export function contentHash(js: string, css: string): string {
  return crypto.createHash("sha256").update(js).update("\0").update(css).digest("hex");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "variant";
}

export function variantDir(
  root: string,
  clientSlug: string,
  testSlug: string,
  variantName: string,
): string {
  return path.join(root, clientSlug, testSlug, slugify(variantName));
}

export function readMeta(dir: string): Meta | null {
  const file = path.join(dir, META_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return metaSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    throw new ValidationError(`${file} is corrupt. Re-pull this variant with --force.`);
  }
}

export function readCode(dir: string): { js: string; css: string } {
  const read = (f: string) => {
    try {
      return fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      throw new ValidationError(`Missing ${f} in ${dir}.`);
    }
  };
  return { js: read(JS_FILE), css: read(CSS_FILE) };
}

export function writeMeta(dir: string, meta: Meta): void {
  fs.writeFileSync(path.join(dir, META_FILE), JSON.stringify(meta, null, 2) + "\n");
}

/** True if the files on disk differ from what was last pulled/pushed. */
export function hasLocalChanges(dir: string): boolean {
  const meta = readMeta(dir);
  if (!meta) return false;
  try {
    const { js, css } = readCode(dir);
    return contentHash(js, css) !== meta.contentHash;
  } catch {
    return true;
  }
}

export function writeVariantFiles(
  dir: string,
  v: { js: string; css: string; version: number },
  ids: { testId: string; variantId: string },
): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, JS_FILE), v.js);
  fs.writeFileSync(path.join(dir, CSS_FILE), v.css);
  writeMeta(dir, {
    ...ids,
    baseVersion: v.version,
    contentHash: contentHash(v.js, v.css),
    pulledAt: new Date().toISOString(),
  });
}
