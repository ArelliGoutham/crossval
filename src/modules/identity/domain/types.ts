import type {
  LoginInput,
  SignUpInput,
} from '@/modules/identity/domain/schemas';

export interface AuthenticatedMerchant {
  userId: string;
  merchantId: string;
}

export interface StoredUser {
  id: string;
  merchantId: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewStoredUser {
  id: string;
  merchantId: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSession extends AuthenticatedMerchant {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface NewStoredSession {
  id: string;
  userId: string;
  merchantId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionRecord {
  token: string;
  expiresAt: Date;
}

export interface SignUpResult {
  merchant: AuthenticatedMerchant;
  session: SessionRecord;
}

export interface LoginResult {
  merchant: AuthenticatedMerchant;
  session: SessionRecord;
}

export interface SignUpUseCase {
  signUp(input: SignUpInput): Promise<SignUpResult>;
}

export interface LoginUseCase {
  login(input: LoginInput): Promise<LoginResult>;
}

export interface LogoutUseCase {
  logout(sessionToken: string): Promise<void>;
}

export interface RequireMerchantUseCase {
  requireMerchant(sessionToken: string): Promise<AuthenticatedMerchant>;
}
