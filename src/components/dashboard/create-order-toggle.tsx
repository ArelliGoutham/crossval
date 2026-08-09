'use client';

import { useState } from 'react';

import { CreateOrderForm } from '@/components/dashboard/create-order-form';

export function CreateOrderToggle(): React.JSX.Element {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="mt-2">
        <CreateOrderForm />
        <div className="text-center mt-2">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowForm(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="btn btn--primary btn--sm"
      onClick={() => setShowForm(true)}
      type="button"
    >
      + New Order
    </button>
  );
}
