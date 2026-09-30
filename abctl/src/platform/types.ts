export interface User {
  id: string;
  email: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: User;
  expiresAt: string;
}

export interface Variant {
  id: string;
  name: string;
  trafficPct: number;
  js: string;
  css: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

/** A test with its client context, as needed to lay out files on disk. */
export interface TestDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  variants: Variant[];
}

export interface TestSummary {
  id: string;
  name: string;
  status: string;
  clientName: string;
  clientSlug: string;
  variants: { id: string; name: string; version: number }[];
}

export interface PushInput {
  testId: string;
  variantId: string;
  js: string;
  css: string;
  /** The version the developer pulled. */
  baseVersion: number;
  message?: string;
  force?: boolean;
}

/**
 * The only surface commands may use to talk to the platform.
 * localJsonClient implements it against db.json; an httpClient would
 * implement the same interface against the real API.
 */
export interface PlatformClient {
  login(email: string, password: string): Promise<LoginResult>;
  whoami(token: string): Promise<User>;
  listTests(token: string, opts?: { clientSlug?: string }): Promise<TestSummary[]>;
  getTest(token: string, testId: string): Promise<TestDetail>;
  getVariant(token: string, testId: string, variantId: string): Promise<Variant>;
  /** Throws ConflictError if the remote version != baseVersion and !force. */
  pushVariant(token: string, input: PushInput): Promise<Variant>;
}
