'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

interface LineItemInput {
  description: string;
  quantity: string;
  unitPriceMinor: string;
}

export function CreateOrderForm(): React.JSX.Element {
  const router = useRouter();
  const [customer, setCustomer] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { description: '', quantity: '1', unitPriceMinor: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addLineItem(): void {
    setLineItems((items) => [
      ...items,
      { description: '', quantity: '1', unitPriceMinor: '' },
    ]);
  }

  function updateLineItem(
    index: number,
    field: keyof LineItemInput,
    value: string,
  ): void {
    setLineItems((items) =>
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsedItems = lineItems.map((item) => ({
      description: item.description.trim(),
      quantity: Number.parseInt(item.quantity, 10),
      unitPriceMinor: Number.parseInt(item.unitPriceMinor, 10),
    }));

    for (const item of parsedItems) {
      if (
        item.description === '' ||
        Number.isNaN(item.quantity) ||
        item.quantity < 1 ||
        Number.isNaN(item.unitPriceMinor) ||
        item.unitPriceMinor < 1
      ) {
        setError(
          'All line items need a description, quantity >= 1, and unit price >= 1.',
        );
        return;
      }
    }

    if (customer.trim() === '' || dueDate === '') {
      setError('Customer name and due date are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          customer: customer.trim(),
          dueDate,
          lineItems: parsedItems,
        }),
      });

      if (!response.ok) {
        setError('Unable to create order. Please check your input.');
        return;
      }

      router.refresh();
    } catch {
      setError('Unable to connect right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Order</h2>
      <div>
        <label htmlFor="order-customer">Customer</label>
        <input
          id="order-customer"
          name="customer"
          onChange={(e) => setCustomer(e.target.value)}
          type="text"
          value={customer}
        />
      </div>
      <div>
        <label htmlFor="order-due-date">Due Date</label>
        <input
          id="order-due-date"
          name="dueDate"
          onChange={(e) => setDueDate(e.target.value)}
          type="date"
          value={dueDate}
        />
      </div>
      <fieldset>
        <legend>Line Items</legend>
        {lineItems.map((item, index) => (
          <div key={index}>
            <input
              onChange={(e) =>
                updateLineItem(index, 'description', e.target.value)
              }
              placeholder="Description"
              type="text"
              value={item.description}
            />
            <input
              inputMode="numeric"
              min="1"
              onChange={(e) =>
                updateLineItem(index, 'quantity', e.target.value)
              }
              placeholder="Qty"
              type="number"
              value={item.quantity}
            />
            <input
              inputMode="numeric"
              min="1"
              onChange={(e) =>
                updateLineItem(index, 'unitPriceMinor', e.target.value)
              }
              placeholder="Unit price (cents)"
              type="number"
              value={item.unitPriceMinor}
            />
          </div>
        ))}
        <button onClick={addLineItem} type="button">
          Add Line Item
        </button>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </button>
    </form>
  );
}
