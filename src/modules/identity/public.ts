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
  AuthenticatedMerchant,
  LoginResult,
  LoginUseCase,
  LogoutUseCase,
  RequireMerchantUseCase,
  SessionRecord,
  SignUpResult,
  SignUpUseCase,
} from '@/modules/identity/domain/types';

export async function composeIdentityService(): Promise<
  import('@/modules/identity/application/identity-service').IdentityService
> {
  const { createIdentityModule } =
    await import('@/modules/identity/infrastructure/create-identity-module');
  return createIdentityModule();
}
