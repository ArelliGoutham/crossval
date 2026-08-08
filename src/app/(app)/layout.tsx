import type { ReactNode } from 'react';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { IdentityError } from '@/modules/identity/public';
import { createIdentityModule } from '@/modules/identity/infrastructure/create-identity-module';
import { SESSION_COOKIE_NAME } from '@/shared/http/request-context';

interface AppLayoutProperties {
  readonly children: ReactNode;
}

export default async function AppLayout({
  children,
}: AppLayoutProperties): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken === undefined) {
    redirect('/login');
  }

  try {
    const identityModule = await createIdentityModule();

    await identityModule.requireMerchant(sessionToken);
  } catch (error: unknown) {
    if (
      error instanceof IdentityError &&
      error.code === 'unauthorized'
    ) {
      redirect('/login');
    }

    throw error;
  }

  return <>{children}</>;
}
