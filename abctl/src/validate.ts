import { parse } from "acorn";
import { ValidationError } from "./errors.js";

export const MAX_BYTES = 100 * 1024;

export function validateJs(js: string): void {
  if (js.trim() === "") return;
  try {
    parse(js, { ecmaVersion: "latest", sourceType: "script" });
  } catch (err) {
    const loc = (err as { loc?: { line: number; column: number } }).loc;
    const msg = (err as Error).message.replace(/\s*\(\d+:\d+\)$/, "");
    throw new ValidationError(
      `variation.js has a syntax error${loc ? ` at line ${loc.line}, column ${loc.column + 1}` : ""}: ${msg}`,
    );
  }
}

/** Cheap sanity check: braces must balance (ignoring comments and strings). */
export function validateCss(css: string): void {
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, "");
  let depth = 0;
  let line = 1;
  for (const ch of stripped) {
    if (ch === "\n") line++;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) {
      throw new ValidationError(`variation.css has an unmatched "}" at line ${line}.`);
    }
  }
  if (depth > 0) throw new ValidationError(`variation.css has ${depth} unclosed "{".`);
}

export function validateCode(js: string, css: string): void {
  if (Buffer.byteLength(js) > MAX_BYTES) {
    throw new ValidationError("variation.js is larger than 100 KB.");
  }
  if (Buffer.byteLength(css) > MAX_BYTES) {
    throw new ValidationError("variation.css is larger than 100 KB.");
  }
  if (js.trim() === "" && css.trim() === "") {
    throw new ValidationError("Both variation.js and variation.css are empty.");
  }
  validateJs(js);
  validateCss(css);
}
