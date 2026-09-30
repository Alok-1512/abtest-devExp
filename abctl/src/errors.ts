export class AbctlError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConflictError extends AbctlError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class AuthError extends AbctlError {
  constructor(message: string) {
    super(message, 3);
  }
}

export class ValidationError extends AbctlError {
  constructor(message: string) {
    super(message, 4);
  }
}

export class NotFoundError extends AbctlError {
  constructor(message: string) {
    super(message, 5);
  }
}
