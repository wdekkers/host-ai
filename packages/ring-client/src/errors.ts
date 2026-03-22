export class RingAuthError extends Error {
  constructor(message = 'Ring authentication failed') {
    super(message);
    this.name = 'RingAuthError';
  }
}

export class Requires2FAError extends Error {
  constructor(message = 'Ring requires 2FA but no on2FA callback was provided') {
    super(message);
    this.name = 'Requires2FAError';
  }
}

export class RingTokenExpiredError extends Error {
  constructor(message = 'Ring refresh token is invalid — re-authentication required') {
    super(message);
    this.name = 'RingTokenExpiredError';
  }
}

export class RingNetworkError extends Error {
  constructor(message = 'Ring API unreachable') {
    super(message);
    this.name = 'RingNetworkError';
  }
}
