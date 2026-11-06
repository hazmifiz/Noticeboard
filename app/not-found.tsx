import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900">
          404
        </h1>

        <h2 className="mt-4 text-xl font-semibold text-slate-800">
          Page Not Found
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          This page may have been moved, deleted,
          or is no longer available.
        </p>

        <Link
          href="/feed"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Return to Feed
        </Link>
      </div>
    </main>
  );
}