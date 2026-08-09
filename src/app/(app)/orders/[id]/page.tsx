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
    <main className="app-main">
      <Link href="/dashboard" className="detail-back">
        &larr; Back to Dashboard
      </Link>

      <div className="detail-header">
        <div>
          <h1 className="detail-customer">{order.customer}</h1>
          <p className="detail-meta">Due: {order.dueDate}</p>
        </div>
        <span className={`badge badge--${order.status} badge--lg`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      <div className="detail-section">
        <h2 className="detail-section__title">Line Items</h2>
        <div className="table-wrap">
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
            </tfoot>
          </table>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="detail-section__title">Settlement Summary</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-item__label">Total</div>
            <div className="summary-item__value">
              {formatMinor(order.totalMinor)}
            </div>
          </div>
          <div className="summary-item summary-item--success">
            <div className="summary-item__label">Paid</div>
            <div className="summary-item__value">
              {formatMinor(order.amountPaidMinor)}
            </div>
          </div>
          <div className="summary-item summary-item--accent">
            <div className="summary-item__label">Amount Due</div>
            <div className="summary-item__value">
              {formatMinor(order.amountDueMinor)}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-item__label">Payments</div>
            <div className="summary-item__value">{order.paymentCount}</div>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="detail-section__title">Payment History</h2>
        {order.payments.length === 0 ? (
          <div className="card card--pad">
            <p className="empty__text">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
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
                    <td>{payment.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {order.amountDueMinor > 0 ? (
        <div className="mt-4">
          <PaymentForm
            orderId={order.id}
            amountDueMinor={order.amountDueMinor}
          />
        </div>
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
