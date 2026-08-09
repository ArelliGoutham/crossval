'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

import {
  loginInputSchema,
  signUpInputSchema,
} from '@/modules/identity/schemas';

type CredentialsMode = 'login' | 'sign-up';

interface CredentialsFormProperties {
  mode: CredentialsMode;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const modeCopy = {
  login: {
    alternateHref: '/sign-up',
    alternateLabel: 'Create an account',
    alternatePrompt: "Don't have an account?",
    buttonLabel: 'Log in',
    endpoint: '/api/v1/auth/login',
    heading: 'Welcome back',
    subtitle: 'Enter your credentials to access your dashboard.',
  },
  'sign-up': {
    alternateHref: '/login',
    alternateLabel: 'Log in',
    alternatePrompt: 'Already have an account?',
    buttonLabel: 'Create account',
    endpoint: '/api/v1/auth/sign-up',
    heading: 'Create your account',
    subtitle: 'Start managing orders and payments in minutes.',
  },
} as const;

export function CredentialsForm({
  mode,
}: CredentialsFormProperties): React.JSX.Element {
  const router = useRouter();
  const copy = modeCopy[mode];
  const schema = useMemo(
    () => (mode === 'login' ? loginInputSchema : signUpInputSchema),
    [mode],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse({ email, password });

    if (!parsed.success) {
      setFieldErrors(collectFieldErrors(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(copy.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setFormError(await readSafeErrorMessage(response));
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setFormError('Unable to continue right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="auth-card__title">{copy.heading}</h1>
      <p className="auth-card__subtitle">{copy.subtitle}</p>
      <form noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor={`${mode}-email`}>
            Email
          </label>
          <input
            autoComplete="email"
            className="field__input"
            id={`${mode}-email`}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          {fieldErrors.email ? (
            <p className="field__error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${mode}-password`}>
            Password
          </label>
          <input
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            className="field__input"
            id={`${mode}-password`}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 12 characters"
            type="password"
            value={password}
          />
          {fieldErrors.password ? (
            <p className="field__error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          className="btn btn--primary btn--block"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Please wait...' : copy.buttonLabel}
        </button>
      </form>
      <p className="auth-card__alt">
        {copy.alternatePrompt}{' '}
        <Link href={copy.alternateHref}>{copy.alternateLabel}</Link>
      </p>
    </section>
  );
}

function collectFieldErrors(
  issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>,
): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (field === 'email' && errors.email === undefined) {
      errors.email = issue.message;
    }

    if (field === 'password' && errors.password === undefined) {
      errors.password = issue.message;
    }
  }

  return errors;
}

async function readSafeErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: {
      code?: string;
    };
  } | null;

  switch (body?.error?.code) {
    case 'DUPLICATE_EMAIL':
      return 'An account already exists for that email address.';
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.';
    default:
      return 'Unable to continue right now. Please try again.';
  }
}
