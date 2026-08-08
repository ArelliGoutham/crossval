import type { ReactNode } from 'react';

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
    <div className="app-shell">
      <header className="app-shell__header">
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
