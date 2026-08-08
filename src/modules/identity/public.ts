export {
  loginInputSchema,
  signUpInputSchema,
  type LoginInput,
  type SignUpInput,
} from '@/modules/identity/domain/schemas';
export {
  IdentityError,
  type IdentityErrorCode,
} from '@/modules/identity/domain/errors';
export type {
  AuditLog,
  Clock,
  PasswordHasher,
  SessionRepository,
  SessionTokenGenerator,
  UserRepository,
} from '@/modules/identity/domain/ports';
export type {
  AuthenticatedMerchant,
  LoginResult,
  LoginUseCase,
  LogoutUseCase,
  RequireMerchantUseCase,
  SessionRecord,
  SignUpResult,
  SignUpUseCase,
} from '@/modules/identity/domain/types';
