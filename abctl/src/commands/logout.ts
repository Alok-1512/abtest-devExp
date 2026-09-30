import { clearSession } from "../session.js";

export function logout(): void {
  console.log(clearSession() ? "Logged out." : "Not logged in.");
}
