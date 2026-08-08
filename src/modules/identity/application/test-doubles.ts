import type {
  AuditLog,
  Clock,
  IdentityAuditEvent,
  IdGenerator,
  PasswordHasher,
  SessionRepository,
  SessionTokenGenerator,
  UserRepository,
} from '@/modules/identity/domain/ports';
import type {
  NewStoredSession,
  NewStoredUser,
  StoredSession,
  StoredUser,
} from '@/modules/identity/domain/types';

export class InMemoryUserRepository implements UserRepository {
  readonly users: StoredUser[] = [];

  async findByNormalizedEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async insert(user: NewStoredUser): Promise<StoredUser> {
    const storedUser: StoredUser = { ...user };
    this.users.push(storedUser);
    return storedUser;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: StoredSession[] = [];

  async insert(session: NewStoredSession): Promise<void> {
    this.sessions.push({
      ...session,
      revokedAt: null,
    });
  }

  async findActiveByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<StoredSession | null> {
    return (
      this.sessions.find(
        (session) =>
          session.tokenHash === tokenHash &&
          session.revokedAt === null &&
          session.expiresAt > now,
      ) ?? null
    );
  }

  async revokeActiveByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<StoredSession | null> {
    const session = this.sessions.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        candidate.revokedAt === null &&
        candidate.expiresAt > revokedAt,
    );

    if (session === undefined) {
      return null;
    }

    session.revokedAt = revokedAt;
    return { ...session };
  }
}

export class InMemoryAuditLog implements AuditLog {
  readonly events: IdentityAuditEvent[] = [];

  async record(event: IdentityAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export class FixedClock implements Clock {
  #value: Date;

  constructor(value: Date) {
    this.#value = value;
  }

  now(): Date {
    return this.#value;
  }

  set(value: Date): void {
    this.#value = value;
  }
}

export class FakePasswordHasher implements PasswordHasher {
  readonly hashCalls: string[] = [];
  readonly verifyCalls: Array<{ password: string; passwordHash: string }> = [];

  async hash(password: string): Promise<string> {
    this.hashCalls.push(password);
    return `hashed:${password}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    this.verifyCalls.push({ password, passwordHash });
    return passwordHash === `hashed:${password}`;
  }
}

export class StubSessionTokenGenerator implements SessionTokenGenerator {
  readonly #tokens: string[];
  #index = 0;

  constructor(tokens: string[]) {
    this.#tokens = tokens;
  }

  async generate(): Promise<string> {
    const token = this.#tokens[this.#index];

    if (token === undefined) {
      throw new Error('No session token available');
    }

    this.#index += 1;
    return token;
  }
}

export class StubIdGenerator implements IdGenerator {
  readonly #ids: string[];
  #index = 0;

  constructor(ids: string[]) {
    this.#ids = ids;
  }

  generate(): string {
    const id = this.#ids[this.#index];

    if (id === undefined) {
      throw new Error('No identifier available');
    }

    this.#index += 1;
    return id;
  }
}
