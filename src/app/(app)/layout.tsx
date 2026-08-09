import type { ReactNode } from 'react';
import Link from 'next/link';

import { redirectUnauthenticatedMerchant } from '@/app/auth/merchant-access';
import { LogoutButton } from '@/components/auth/logout-button';

interface AppLayoutProperties {
  readonly children: ReactNode;
}

export default async function AppLayout({
  children,
}: AppLayoutProperties): Promise<React.JSX.Element> {
  await redirectUnauthenticatedMerchant();

  return (
    <div className="shell">
      <header className="shell__header">
        <Link href="/dashboard" className="shell__brand">
          <span className="shell__brand-mark">CV</span>
          CrossVal
        </Link>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
