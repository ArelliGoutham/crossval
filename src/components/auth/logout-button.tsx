'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton(): React.JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        setErrorMessage('Unable to log out right now. Please try again.');
        return;
      }

      router.replace('/login');
      router.refresh();
    } catch {
      setErrorMessage('Unable to log out right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell__actions">
      <button
        className="btn btn--sm btn--ghost"
        onClick={() => void handleLogout()}
        disabled={isSubmitting}
        type="button"
      >
        {isSubmitting ? 'Logging out...' : 'Log out'}
      </button>
      {errorMessage ? (
        <p className="field__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
