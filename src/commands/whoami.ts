import { getClient } from "../platform/index.js";
import { isExpired, readSession } from "../session.js";

export async function whoami(): Promise<void> {
  const session = readSession();
  if (!session) {
    console.log("Not logged in");
    return;
  }
  if (isExpired(session)) {
    console.log("Session expired");
    return;
  }
  const user = await getClient().whoami(session.token);
  console.log(`${user.email} (${user.role})`);
}
