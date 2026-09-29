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
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="text-3xl font-medium text-fg">
            Something went wrong · Что-то пошло не так
          </h1>
          <p className="text-lg text-fg-2">Нещо се обърка. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 self-start rounded-sm bg-accent px-5 py-2.5 font-medium text-accent-ink focus-ring"
          >
            Try again · Повторить · Опитай отново
          </button>
        </main>
      </body>
    </html>
  );
}
