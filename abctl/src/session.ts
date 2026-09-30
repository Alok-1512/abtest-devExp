import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AuthError } from "./errors.js";
import { sessionPath } from "./paths.js";

const sessionSchema = z.object({
  token: z.string(),
  email: z.string(),
  expiresAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

export function readSession(): Session | null {
  try {
    return sessionSchema.parse(JSON.parse(fs.readFileSync(sessionPath(), "utf8")));
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  const file = sessionPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(session, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(file, 0o600); // writeFile's mode is ignored if the file already existed
}

export function clearSession(): boolean {
  try {
    fs.unlinkSync(sessionPath());
    return true;
  } catch {
    return false;
  }
}

export function isExpired(session: Session): boolean {
  return new Date(session.expiresAt) <= new Date();
}

/** For commands that need auth: returns a live session or throws AuthError. */
export function requireSession(): Session {
  const session = readSession();
  if (!session) throw new AuthError("Not logged in. Run `abctl login`.");
  if (isExpired(session)) throw new AuthError("Session expired. Run `abctl login`.");
  return session;
}
