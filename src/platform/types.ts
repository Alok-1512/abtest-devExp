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

/**
 * The only surface commands may use to talk to the platform.
 * localJsonClient implements it against db.json; an httpClient would
 * implement the same interface against the real API.
 */
export interface PlatformClient {
  login(email: string, password: string): Promise<LoginResult>;
  whoami(token: string): Promise<User>;
}
