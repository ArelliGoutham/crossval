import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { CredentialsForm } from '@/components/auth/credentials-form';
import { IdentityError } from '@/modules/identity/public';
import { createIdentityModule } from '@/modules/identity/infrastructure/create-identity-module';
import { SESSION_COOKIE_NAME } from '@/shared/http/request-context';

export default async function SignUpPage(): Promise<React.JSX.Element> {
  await redirectAuthenticatedMerchant();

  return (
    <main>
      <CredentialsForm mode="sign-up" />
    </main>
  );
}

async function redirectAuthenticatedMerchant(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken === undefined) {
    return;
  }

  try {
    const identityModule = await createIdentityModule();

    await identityModule.requireMerchant(sessionToken);
    redirect('/dashboard');
  } catch (error: unknown) {
    if (
      error instanceof IdentityError &&
      error.code === 'unauthorized'
    ) {
      return;
    }

    throw error;
  }
}
