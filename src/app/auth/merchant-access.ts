import { composeRequireMerchant } from '@/app/composition/identity';
import { IdentityError } from '@/modules/identity/public';
import { SESSION_COOKIE_NAME } from '@/shared/http/request-context';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function redirectUnauthenticatedMerchant(): Promise<void> {
  const sessionToken = await readSessionToken();

  if (sessionToken === undefined) {
    redirect('/login');
  }

  try {
    const identity = await composeRequireMerchant();

    await identity.requireMerchant(sessionToken);
  } catch (error: unknown) {
    if (isUnauthorizedIdentityError(error)) {
      redirect('/login');
    }

    throw error;
  }
}

export async function redirectAuthenticatedMerchant(): Promise<void> {
  const sessionToken = await readSessionToken();

  if (sessionToken === undefined) {
    return;
  }

  try {
    const identity = await composeRequireMerchant();

    await identity.requireMerchant(sessionToken);
    redirect('/dashboard');
  } catch (error: unknown) {
    if (isUnauthorizedIdentityError(error)) {
      return;
    }

    throw error;
  }
}

async function readSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

function isUnauthorizedIdentityError(error: unknown): boolean {
  return error instanceof IdentityError && error.code === 'unauthorized';
}
