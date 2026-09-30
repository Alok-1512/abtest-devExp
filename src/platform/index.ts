import { createLocalJsonClient } from "./localJsonClient.js";
import type { PlatformClient } from "./types.js";

/** The one place that decides which backend is used. Swap for an httpClient here. */
export function getClient(): PlatformClient {
  return createLocalJsonClient();
}
