import { createHash } from 'node:crypto';

import { IdentityError } from '@/modules/identity/domain/errors';
import type {
  Clock,
  IdGenerator,
  IdentityTransactionRunner,
  PasswordHasher,
  SessionRepository,
  SessionTokenGenerator,
  UserRepository,
} from '@/modules/identity/domain/ports';
import {
  loginInputSchema,
  signUpInputSchema,
  type LoginInput,
  type SignUpInput,
} from '@/modules/identity/domain/schemas';
import type {
  AuthenticatedMerchant,
  LoginResult,
  LogoutUseCase,
  LoginUseCase,
  RequireMerchantUseCase,
  NewStoredSession,
  SessionRecord,
  SignUpResult,
  SignUpUseCase,
} from '@/modules/identity/domain/types';

const INVALID_CREDENTIALS_ERROR = new IdentityError('invalid_credentials');
const UNAUTHORIZED_ERROR = new IdentityError('unauthorized');

type IdentityServiceDependencies = {
  users: UserRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  tokens: SessionTokenGenerator;
  ids: IdGenerator;
  clock: Clock;
  transactions: IdentityTransactionRunner;
  dummyPasswordHash: string;
};

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export class IdentityService
  implements SignUpUseCase, LoginUseCase, LogoutUseCase, RequireMerchantUseCase
{
  readonly #users: UserRepository;
  readonly #sessions: SessionRepository;
  readonly #hasher: PasswordHasher;
  readonly #tokens: SessionTokenGenerator;
  readonly #ids: IdGenerator;
  readonly #clock: Clock;
  readonly #transactions: IdentityTransactionRunner;
  readonly #dummyPasswordHash: string;

  constructor(dependencies: IdentityServiceDependencies) {
    this.#users = dependencies.users;
    this.#sessions = dependencies.sessions;
    this.#hasher = dependencies.hasher;
    this.#tokens = dependencies.tokens;
    this.#ids = dependencies.ids;
    this.#clock = dependencies.clock;
    this.#transactions = dependencies.transactions;
    this.#dummyPasswordHash = dependencies.dummyPasswordHash;
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const credentials = signUpInputSchema.parse(input);
    const existingUser = await this.#users.findByNormalizedEmail(
      credentials.email,
    );

    if (existingUser !== null) {
      throw new IdentityError('duplicate_email');
    }

    const now = this.#clock.now();
    const passwordHash = await this.#hasher.hash(credentials.password);
    const userId = this.#ids.generate();
    const merchantId = this.#ids.generate();

    const user = {
      id: userId,
      merchantId,
      email: credentials.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    const session = await this.#createSession(
      {
        userId: user.id,
        merchantId: user.merchantId,
      },
      now,
    );

    await this.#transactions.run(async (identity) => {
      await identity.insertUser(user);
      await identity.insertSession(session.storedSession);
      await identity.recordAudit({
        action: 'identity.sign_up.succeeded',
        occurredAt: now,
        userId: user.id,
        merchantId: user.merchantId,
      });
    });

    return {
      identity: {
        userId: user.id,
        merchantId: user.merchantId,
      },
      session: session.record,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const credentials = loginInputSchema.parse(input);
    const user = await this.#users.findByNormalizedEmail(credentials.email);

    const passwordMatches = await this.#hasher.verify(
      credentials.password,
      user?.passwordHash ?? this.#dummyPasswordHash,
    );

    if (user === null || !passwordMatches) {
      throw INVALID_CREDENTIALS_ERROR;
    }

    const now = this.#clock.now();
    const session = await this.#createSession(
      {
        userId: user.id,
        merchantId: user.merchantId,
      },
      now,
    );

    await this.#transactions.run(async (identity) => {
      await identity.insertSession(session.storedSession);
      await identity.recordAudit({
        action: 'identity.login.succeeded',
        occurredAt: now,
        userId: user.id,
        merchantId: user.merchantId,
      });
    });

    return {
      identity: {
        userId: user.id,
        merchantId: user.merchantId,
      },
      session: session.record,
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const now = this.#clock.now();
    const tokenHash = hashToken(sessionToken);
    await this.#transactions.run(async (identity) => {
      const session = await identity.revokeActiveByTokenHash(tokenHash, now);

      if (session === null) {
        return;
      }

      await identity.recordAudit({
        action: 'identity.session.revoked',
        occurredAt: now,
        userId: session.userId,
        merchantId: session.merchantId,
      });
      await identity.recordAudit({
        action: 'identity.logout.succeeded',
        occurredAt: now,
        userId: session.userId,
        merchantId: session.merchantId,
      });
    });
  }

  async requireMerchant(sessionToken: string): Promise<AuthenticatedMerchant> {
    const session = await this.#sessions.findActiveByTokenHash(
      hashToken(sessionToken),
      this.#clock.now(),
    );

    if (session === null) {
      throw UNAUTHORIZED_ERROR;
    }

    return {
      userId: session.userId,
      merchantId: session.merchantId,
    };
  }

  async #createSession(
    identity: AuthenticatedMerchant,
    now: Date,
  ): Promise<{ record: SessionRecord; storedSession: NewStoredSession }> {
    const token = await this.#tokens.generate();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

    const storedSession = {
      id: this.#ids.generate(),
      userId: identity.userId,
      merchantId: identity.merchantId,
      tokenHash: hashToken(token),
      expiresAt,
      createdAt: now,
    };

    return {
      record: {
        token,
        expiresAt,
      },
      storedSession,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
