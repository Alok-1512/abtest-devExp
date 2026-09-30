import { dbPath } from "../paths.js";
import { seedDb } from "../platform/seed.js";

export function seed(): void {
  seedDb();
  console.log(`Mock data reset at ${dbPath()}`);
  console.log("Login with dev@demo.com / demo1234");
}
