import pc from "picocolors";
import { getClient } from "../platform/index.js";
import { requireSession } from "../session.js";

export async function tests(opts: { client?: string }): Promise<void> {
  const session = requireSession();
  const list = await getClient().listTests(session.token, { clientSlug: opts.client });
  if (list.length === 0) {
    console.log("No tests found.");
    return;
  }

  const rows = list.map((t) => [
    t.clientSlug,
    t.name,
    t.id,
    t.status,
    t.variants.map((v) => `${v.id} ${v.name} (v${v.version})`).join(", "),
  ]);
  const header = ["CLIENT", "TEST", "ID", "STATUS", "VARIANTS"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();

  console.log(pc.bold(line(header)));
  for (const r of rows) console.log(line(r));
}
