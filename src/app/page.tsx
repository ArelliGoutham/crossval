import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="landing">
      <div className="landing__content">
        <div className="landing__brand">
          <span className="landing__brand-mark">CV</span>
          <span className="landing__brand-name">CrossVal</span>
        </div>
        <h1 className="landing__headline">
          Track orders and settlements with confidence.
        </h1>
        <p className="landing__sub">
          Create orders with line items, record partial payments, and monitor
          settlement status — all in one place.
        </p>
        <div className="landing__actions">
          <Link className="btn btn--primary" href="/sign-up">
            Get started free
          </Link>
          <Link className="btn" href="/login">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
