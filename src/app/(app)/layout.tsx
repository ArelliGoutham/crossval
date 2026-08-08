import type { ReactNode } from 'react';

import { redirectUnauthenticatedMerchant } from '@/app/auth/merchant-access';

interface AppLayoutProperties {
  readonly children: ReactNode;
}

export default async function AppLayout({
  children,
}: AppLayoutProperties): Promise<React.JSX.Element> {
  await redirectUnauthenticatedMerchant();

  return <>{children}</>;
}
