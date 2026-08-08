import type {
  NewStoredSession,
  NewStoredUser,
  StoredSession,
  StoredUser,
} from '@/modules/identity/domain/types';

export interface UserRepository {
  findByNormalizedEmail(email: string): Promise<StoredUser | null>;
  insert(user: NewStoredUser): Promise<StoredUser>;
}

export interface SessionRepository {
  insert(session: NewStoredSession): Promise<void>;
  findActiveByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<StoredSession | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

export interface SessionTokenGenerator {
  generate(): Promise<string>;
}

export interface Clock {
  now(): Date;
}

export interface AuditLog {
  record(event: IdentityAuditEvent): Promise<void>;
}

export interface IdentityAuditEvent {
  action:
    | 'identity.sign_up.succeeded'
    | 'identity.login.succeeded'
    | 'identity.logout.succeeded'
    | 'identity.session.revoked';
  occurredAt: Date;
  userId: string | null;
  merchantId: string | null;
}
