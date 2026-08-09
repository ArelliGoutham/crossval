import Link from 'next/link';

import { composeIdentityService } from '@/modules/identity/public';
import { composeDashboardService } from '@/modules/dashboard/public';
import { dashboardFilterSchema } from '@/modules/dashboard/domain/schemas';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CreateOrderForm } from '@/components/dashboard/create-order-form';

interface DashboardPageProperties {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_FILTERS = [
  'all',
  'pending',
  'partially_paid',
  'paid',
  'overdue',
] as const;

export default async function DashboardPage({
  searchParams,
}: DashboardPageProperties): Promise<React.JSX.Element> {
  const headerStore = await headers();
  const cookieHeader = headerStore.get('cookie') ?? '';
  const sessionToken = extractSessionToken(cookieHeader);

  if (sessionToken === undefined) {
    redirect('/login');
  }

  const identityService = await composeIdentityService();
  const merchant = await identityService.requireMerchant(sessionToken);

  const params = await searchParams;
  const validated = dashboardFilterSchema.safeParse(params);
  const filters = validated.success ? validated.data : {};

  const dashboardService = await composeDashboardService();
  const orders = await dashboardService.getDashboardOrders(merchant, filters);

  return (
    <main>
      <h1>Orders</h1>
      <nav className="status-filters">
        {STATUS_FILTERS.map((status) => (
          <Link
            className={
              status === 'all' && filters.status === undefined
                ? 'active'
                : filters.status === status
                  ? 'active'
                  : ''
            }
            href={
              status === 'all' ? '/dashboard' : `/dashboard?status=${status}`
            }
            key={status}
          >
            {status.replace('_', ' ')}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders found. Create one to get started.</p>
          <CreateOrderForm />
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/orders/${order.id}`}>{order.customer}</Link>
                </td>
                <td className={`status status--${order.status}`}>
                  {order.status.replace('_', ' ')}
                </td>
                <td>{formatMinor(order.totalMinor)}</td>
                <td>{formatMinor(order.amountPaidMinor)}</td>
                <td>{formatMinor(order.amountDueMinor)}</td>
                <td>{order.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function formatMinor(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

function extractSessionToken(cookieHeader: string): string | undefined {
  const match = /(?:^|;\s*)session=([^;]+)/.exec(cookieHeader);
  return match?.[1];
}
