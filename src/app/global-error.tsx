'use client';

import '@/styles/globals.css';

/** Last line of defence when the root layout itself fails. Never a white screen. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-accent="amber">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-3xl font-semibold text-fg">
            Something went wrong · Что-то пошло не так
          </h1>
          <p className="text-lg text-fg-2">Нещо се обърка. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-accent px-6 py-3 font-semibold text-accent-ink focus-ring"
          >
            Try again · Повторить · Опитай отново
          </button>
        </main>
      </body>
    </html>
  );
}
