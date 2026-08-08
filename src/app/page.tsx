import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>CrossVal</h1>
      <p>Track orders and settlements with confidence.</p>
      <nav aria-label="Authentication">
        <Link href="/login">Log in</Link>
        <Link href="/sign-up">Sign up</Link>
      </nav>
    </main>
  );
}
