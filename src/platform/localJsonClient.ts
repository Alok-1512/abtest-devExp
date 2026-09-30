import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AuthError, NotFoundError } from "../errors.js";
import { dbPath } from "../paths.js";
import type {
  LoginResult,
  PlatformClient,
  TestDetail,
  TestSummary,
  User,
  Variant,
} from "./types.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const historySchema = z.object({
  version: z.number().int(),
  at: z.string(),
  by: z.string(),
  message: z.string(),
});

const variantSchema = z.object({
  id: z.string(),
  name: z.string(),
  trafficPct: z.number(),
  js: z.string(),
  css: z.string(),
  version: z.number().int(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  history: z.array(historySchema),
});

const dbSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      passwordHash: z.string(),
      role: z.string(),
    }),
  ),
  sessions: z.array(
    z.object({ token: z.string(), userId: z.string(), expiresAt: z.string() }),
  ),
  clients: z.array(
    z.object({ id: z.string(), name: z.string(), slug: z.string(), domain: z.string() }),
  ),
  tests: z.array(
    z.object({
      id: z.string(),
      clientId: z.string(),
      name: z.string(),
      slug: z.string(),
      status: z.string(),
      variants: z.array(variantSchema),
    }),
  ),
});

export type Db = z.infer<typeof dbSchema>;

// ---- password hashing: scrypt$salt$hash (hex) ----

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Fixed hash so login does the same work whether or not the email exists.
const DUMMY_HASH = hashPassword("not-a-real-password");

// ---- storage ----

function readDb(): Db {
  const file = dbPath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`Mock database not found at ${file}. Run \`abctl seed\` first.`);
  }
  return dbSchema.parse(JSON.parse(raw));
}

/** Atomic write: temp file in the same dir, then rename. */
export function writeDb(db: Db): void {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

const toUser = (u: { id: string; email: string; role: string }): User => ({
  id: u.id,
  email: u.email,
  role: u.role,
});

function authenticate(db: Db, token: string): Db["users"][number] {
  const session = db.sessions.find((s) => s.token === token);
  if (!session) throw new AuthError("Session is not valid. Run `abctl login`.");
  if (new Date(session.expiresAt) <= new Date()) {
    throw new AuthError("Session expired. Run `abctl login`.");
  }
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) throw new AuthError("Session is not valid. Run `abctl login`.");
  return user;
}

const toVariant = (v: Db["tests"][number]["variants"][number]): Variant => ({
  id: v.id,
  name: v.name,
  trafficPct: v.trafficPct,
  js: v.js,
  css: v.css,
  version: v.version,
  updatedAt: v.updatedAt,
  updatedBy: v.updatedBy,
});

function findTest(db: Db, testId: string): TestDetail {
  const t = db.tests.find((x) => x.id === testId);
  if (!t) throw new NotFoundError(`Test "${testId}" not found. Run \`abctl tests\` to list ids.`);
  const client = db.clients.find((c) => c.id === t.clientId)!;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    variants: t.variants.map(toVariant),
  };
}

function findVariant(test: TestDetail, variantId: string): Variant {
  const v = test.variants.find((x) => x.id === variantId);
  if (!v) throw new NotFoundError(`Variant "${variantId}" not found in test ${test.id}.`);
  return v;
}

export function createLocalJsonClient(): PlatformClient {
  return {
    async login(email, password): Promise<LoginResult> {
      const db = readDb();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw new AuthError("Invalid email or password.");

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > new Date());
      db.sessions.push({ token, userId: user.id, expiresAt });
      writeDb(db);
      return { token, user: toUser(user), expiresAt };
    },

    async whoami(token): Promise<User> {
      return toUser(authenticate(readDb(), token));
    },

    async listTests(token, opts): Promise<TestSummary[]> {
      const db = readDb();
      authenticate(db, token);
      if (opts?.clientSlug && !db.clients.some((c) => c.slug === opts.clientSlug)) {
        throw new NotFoundError(`Client "${opts.clientSlug}" not found.`);
      }
      return db.tests
        .map((t) => ({ t, client: db.clients.find((c) => c.id === t.clientId)! }))
        .filter(({ client }) => !opts?.clientSlug || client.slug === opts.clientSlug)
        .map(({ t, client }) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          clientName: client.name,
          clientSlug: client.slug,
          variants: t.variants.map((v) => ({ id: v.id, name: v.name, version: v.version })),
        }));
    },

    async getTest(token, testId): Promise<TestDetail> {
      const db = readDb();
      authenticate(db, token);
      return findTest(db, testId);
    },

    async getVariant(token, testId, variantId): Promise<Variant> {
      const db = readDb();
      authenticate(db, token);
      return findVariant(findTest(db, testId), variantId);
    },
  };
}
