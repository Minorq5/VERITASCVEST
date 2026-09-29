import type { Metadata } from 'next';
import Link from 'next/link';
import { fontVariables } from '@/app/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '404 · Veritas Tasks',
};

/** Requests outside any locale (e.g. /xx/unknown). Trilingual, no JavaScript needed. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables} data-accent="cyan">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-mono text-sm tracking-[0.3em] text-accent">404</p>
          <h1 className="font-display text-3xl font-semibold text-fg">
            You drifted beyond the galaxy
          </h1>
          <p className="text-lg text-fg-2" lang="ru">
            Ты улетел за пределы галактики
          </p>
          <p className="text-lg text-fg-2" lang="bg">
            Излетя отвъд галактиката
          </p>
          <Link
            href="/"
            className="mt-6 rounded-md bg-accent px-6 py-3 font-semibold text-accent-ink focus-ring"
          >
            Veritas Tasks
          </Link>
        </main>
      </body>
    </html>
  );
}
