import os from "node:os";
import path from "node:path";

/** Directory holding the session file (and the mock db by default). */
export function abctlHome(): string {
  return process.env.ABCTL_HOME ?? path.join(os.homedir(), ".abctl");
}

export function sessionPath(): string {
  return path.join(abctlHome(), "session.json");
}

/** Location of the mock backend's JSON file. */
export function dbPath(): string {
  return process.env.ABCTL_DB ?? path.join(abctlHome(), "db.json");
}
