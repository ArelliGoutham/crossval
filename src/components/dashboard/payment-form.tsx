'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

interface PaymentFormProperties {
  orderId: string;
  amountDueMinor: number;
}

export function PaymentForm({
  orderId,
  amountDueMinor,
}: PaymentFormProperties): React.JSX.Element {
  const router = useRouter();
  const [amountMinor, setAmountMinor] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);

    const amount = Number.parseInt(amountMinor, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Enter a valid positive integer amount.');
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`/api/v1/orders/${orderId}/payments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          amountMinor: amount,
          paymentDate,
          note: note.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: {
            code?: string;
            details?: { maximumAllowedAmountMinor?: number };
          };
        } | null;

        if (body?.error?.code === 'OVERPAYMENT') {
          const max = body.error.details?.maximumAllowedAmountMinor;
          const maxDollars = max !== undefined ? (max / 100).toFixed(2) : '0';
          setError(
            `Payment exceeds remaining balance. Maximum allowed: $${maxDollars}.`,
          );
        } else {
          setError('Unable to record payment. Please try again.');
        }
        return;
      }

      setAmountMinor('');
      setNote('');
      router.refresh();
    } catch {
      setError('Unable to connect right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const dueDisplay = (amountDueMinor / 100).toFixed(2);

  return (
    <form onSubmit={handleSubmit}>
      <h2>Record Payment</h2>
      <p>Amount due: ${dueDisplay}</p>
      <div>
        <label htmlFor="payment-amount">Amount (in cents)</label>
        <input
          id="payment-amount"
          inputMode="numeric"
          min="1"
          name="amountMinor"
          onChange={(e) => setAmountMinor(e.target.value)}
          placeholder="e.g. 40000"
          type="number"
          value={amountMinor}
        />
      </div>
      <div>
        <label htmlFor="payment-date">Payment Date</label>
        <input
          id="payment-date"
          name="paymentDate"
          onChange={(e) => setPaymentDate(e.target.value)}
          type="date"
          value={paymentDate}
        />
      </div>
      <div>
        <label htmlFor="payment-note">Note (optional)</label>
        <input
          id="payment-note"
          maxLength={1000}
          name="note"
          onChange={(e) => setNote(e.target.value)}
          type="text"
          value={note}
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Recording...' : 'Record Payment'}
      </button>
    </form>
  );
}
