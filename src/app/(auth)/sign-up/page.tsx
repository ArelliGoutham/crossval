import { redirectAuthenticatedMerchant } from '@/app/auth/merchant-access';
import { CredentialsForm } from '@/components/auth/credentials-form';

export default async function SignUpPage(): Promise<React.JSX.Element> {
  await redirectAuthenticatedMerchant();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <span className="auth-card__logo-mark">CV</span>
          <span className="auth-card__logo-text">CrossVal</span>
        </div>
        <CredentialsForm mode="sign-up" />
      </div>
    </div>
  );
}
