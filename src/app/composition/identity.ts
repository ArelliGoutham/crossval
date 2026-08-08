import type { RequireMerchantUseCase } from '@/modules/identity/public';
import { createIdentityModule } from '@/modules/identity/infrastructure/create-identity-module';

export async function composeRequireMerchant(): Promise<RequireMerchantUseCase> {
  return createIdentityModule();
}
