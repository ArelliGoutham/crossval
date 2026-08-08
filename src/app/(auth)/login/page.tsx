import { redirectAuthenticatedMerchant } from '@/app/auth/merchant-access';
import { CredentialsForm } from '@/components/auth/credentials-form';

export default async function LoginPage(): Promise<React.JSX.Element> {
  await redirectAuthenticatedMerchant();

  return (
    <main>
      <CredentialsForm mode="login" />
    </main>
  );
}
