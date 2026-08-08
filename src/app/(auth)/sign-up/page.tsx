import { redirectAuthenticatedMerchant } from '@/app/auth/merchant-access';
import { CredentialsForm } from '@/components/auth/credentials-form';

export default async function SignUpPage(): Promise<React.JSX.Element> {
  await redirectAuthenticatedMerchant();

  return (
    <main>
      <CredentialsForm mode="sign-up" />
    </main>
  );
}
