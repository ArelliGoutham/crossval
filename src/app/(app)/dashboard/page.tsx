import Link from 'next/link';

import { composeIdentityService } from '@/modules/identity/public';
import { composeDashboardService } from '@/modules/dashboard/public';
import { dashboardFilterSchema } from '@/modules/dashboard/domain/schemas';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CreateOrderForm } from '@/components/dashboard/create-order-form';
import { CreateOrderToggle } from '@/components/dashboard/create-order-toggle';

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
    <main className="app-main">
      <div className="dash-header">
        <h1 className="dash-title">Orders</h1>
        <CreateOrderToggle />
      </div>

      <div className="filters">
        {STATUS_FILTERS.map((status) => (
          <Link
            className={`filter-pill ${status === 'all' && filters.status === undefined ? 'filter-pill--active' : filters.status === status ? 'filter-pill--active' : ''}`}
            href={
              status === 'all' ? '/dashboard' : `/dashboard?status=${status}`
            }
            key={status}
          >
            {status.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card card--pad">
          <div className="empty">
            <div className="empty__icon">&#128230;</div>
            <p className="empty__text">
              No orders found. Create one to get started.
            </p>
          </div>
          <CreateOrderForm />
        </div>
      ) : (
        <div className="table-wrap">
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
                  <td>
                    <span className={`badge badge--${order.status}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatMinor(order.totalMinor)}</td>
                  <td>{formatMinor(order.amountPaidMinor)}</td>
                  <td>{formatMinor(order.amountDueMinor)}</td>
                  <td>{order.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
