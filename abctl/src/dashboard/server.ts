// Dummy web dashboard for the mock platform: view tests, edit variant JS/CSS in
// a textarea. Uses the same db.json as the CLI, so browser edits and CLI pushes
// see each other's version bumps. Run: npm run dashboard
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AbctlError } from "../errors.js";
import { dbPath } from "../paths.js";
import { applyVariantUpdate, readDb, writeDb } from "../platform/localJsonClient.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : String(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function overview() {
  const db = readDb();
  return db.clients.map((c) => ({
    ...c,
    tests: db.tests.filter((t) => t.clientId === c.id),
  }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, fs.readFileSync(path.join(here, "index.html"), "utf8"), "text/html");
    }
    if (req.method === "GET" && url.pathname === "/api/clients") {
      return send(res, 200, overview());
    }

    const m = url.pathname.match(/^\/api\/tests\/([^/]+)\/variants\/([^/]+)$/);
    if (req.method === "PUT" && m) {
      const body = JSON.parse(await readBody(req)) as {
        js: string;
        css: string;
        baseVersion: number;
      };
      // read -> apply -> write with no await in between
      const db = readDb();
      const v = applyVariantUpdate(db, {
        testId: m[1],
        variantId: m[2],
        js: body.js,
        css: body.css,
        baseVersion: body.baseVersion,
        message: "Edited in dashboard",
        by: "dashboard",
      });
      writeDb(db);
      return send(res, 200, v);
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    if (err instanceof AbctlError) {
      // ConflictError -> 409, NotFoundError -> 404, others -> 400
      const status = err.exitCode === 2 ? 409 : err.exitCode === 5 ? 404 : 400;
      return send(res, status, { error: err.message });
    }
    send(res, 500, { error: err instanceof Error ? err.message : "Server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dummy platform dashboard: http://localhost:${port}`);
  console.log(`Using mock db at ${dbPath()}`);
});
