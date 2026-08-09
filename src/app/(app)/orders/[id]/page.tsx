import Link from 'next/link';

import { composeIdentityService } from '@/modules/identity/public';
import { composeDashboardService } from '@/modules/dashboard/public';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { PaymentForm } from '@/components/dashboard/payment-form';

interface OrderDetailPageProperties {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProperties): Promise<React.JSX.Element> {
  const { id } = await params;

  const headerStore = await headers();
  const cookieHeader = headerStore.get('cookie') ?? '';
  const sessionToken = extractSessionToken(cookieHeader);

  if (sessionToken === undefined) {
    redirect('/login');
  }

  const identityService = await composeIdentityService();
  let merchant;
  try {
    merchant = await identityService.requireMerchant(sessionToken);
  } catch {
    redirect('/login');
  }

  const dashboardService = await composeDashboardService();
  let order;
  try {
    order = await dashboardService.getOrderDetail(merchant, id);
  } catch {
    notFound();
  }

  return (
    <main>
      <p>
        <Link href="/dashboard">&larr; Back to Dashboard</Link>
      </p>
      <h1>{order.customer}</h1>
      <p>Due: {order.dueDate}</p>
      <p className={`status status--${order.status}`}>
        Status: {order.status.replace('_', ' ')}
      </p>

      <section>
        <h2>Line Items</h2>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatMinor(item.unitPriceMinor)}</td>
                <td>{formatMinor(item.lineTotalMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td>{formatMinor(order.subtotalMinor)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Total</td>
              <td>{formatMinor(order.totalMinor)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Paid</td>
              <td>{formatMinor(order.amountPaidMinor)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Amount Due</td>
              <td>{formatMinor(order.amountDueMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section>
        <h2>Payment History</h2>
        {order.payments.length === 0 ? (
          <p>No payments recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.paymentDate}</td>
                  <td>{formatMinor(payment.amountMinor)}</td>
                  <td>{payment.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {order.amountDueMinor > 0 ? (
        <PaymentForm orderId={order.id} amountDueMinor={order.amountDueMinor} />
      ) : null}
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
