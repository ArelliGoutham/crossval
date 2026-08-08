import { randomUUID, createHash } from 'node:crypto';

import { IdentityError } from '@/modules/identity/domain/errors';
import type {
  AuditLog,
  Clock,
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
  SessionRecord,
  SignUpResult,
  SignUpUseCase,
} from '@/modules/identity/domain/types';

const SESSION_DURATION_IN_DAYS = 7;
const SESSION_DURATION_IN_MILLISECONDS =
  SESSION_DURATION_IN_DAYS * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS_ERROR = new IdentityError('invalid_credentials');
const UNAUTHORIZED_ERROR = new IdentityError('unauthorized');

type IdentityServiceDependencies = {
  users: UserRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  tokens: SessionTokenGenerator;
  clock: Clock;
  audit: AuditLog;
};

export class IdentityService
  implements
    SignUpUseCase,
    LoginUseCase,
    LogoutUseCase,
    RequireMerchantUseCase
{
  readonly #users: UserRepository;
  readonly #sessions: SessionRepository;
  readonly #hasher: PasswordHasher;
  readonly #tokens: SessionTokenGenerator;
  readonly #clock: Clock;
  readonly #audit: AuditLog;

  constructor(dependencies: IdentityServiceDependencies) {
    this.#users = dependencies.users;
    this.#sessions = dependencies.sessions;
    this.#hasher = dependencies.hasher;
    this.#tokens = dependencies.tokens;
    this.#clock = dependencies.clock;
    this.#audit = dependencies.audit;
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
    const userId = randomUUID();
    const merchantId = randomUUID();

    const user = await this.#users.insert({
      id: userId,
      merchantId,
      email: credentials.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    const session = await this.#createSession({
      userId: user.id,
      merchantId: user.merchantId,
    });

    await this.#audit.record({
      action: 'identity.sign_up.succeeded',
      occurredAt: now,
      userId: user.id,
      merchantId: user.merchantId,
    });

    return {
      identity: {
        userId: user.id,
        merchantId: user.merchantId,
      },
      session,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const credentials = loginInputSchema.parse(input);
    const user = await this.#users.findByNormalizedEmail(credentials.email);

    if (user === null) {
      throw INVALID_CREDENTIALS_ERROR;
    }

    const passwordMatches = await this.#hasher.verify(
      credentials.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw INVALID_CREDENTIALS_ERROR;
    }

    const session = await this.#createSession({
      userId: user.id,
      merchantId: user.merchantId,
    });
    const now = this.#clock.now();

    await this.#audit.record({
      action: 'identity.login.succeeded',
      occurredAt: now,
      userId: user.id,
      merchantId: user.merchantId,
    });

    return {
      identity: {
        userId: user.id,
        merchantId: user.merchantId,
      },
      session,
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const now = this.#clock.now();
    const tokenHash = hashToken(sessionToken);

    await this.#sessions.revokeByTokenHash(tokenHash, now);
    await this.#audit.record({
      action: 'identity.logout.succeeded',
      occurredAt: now,
      userId: null,
      merchantId: null,
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
  ): Promise<SessionRecord> {
    const now = this.#clock.now();
    const token = await this.#tokens.generate();
    const expiresAt = new Date(
      now.getTime() + SESSION_DURATION_IN_MILLISECONDS,
    );

    await this.#sessions.insert({
      id: randomUUID(),
      userId: identity.userId,
      merchantId: identity.merchantId,
      tokenHash: hashToken(token),
      expiresAt,
      createdAt: now,
    });

    return {
      token,
      expiresAt,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
