import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { fontVariables } from '@/app/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '404 · Veritas Tasks',
};

/** Requests outside any locale (e.g. /xx/unknown). Trilingual, no JavaScript needed. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables} data-accent="amber">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-16">
          <Image
            src="/cinema/small.webp"
            alt=""
            width={700}
            height={500}
            unoptimized
            className="mb-10 w-full rounded-md border border-line"
          />
          <p className="label-mono text-accent">404</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-fg">
            Beyond the event horizon
          </h1>
          <p className="mt-2 text-lg text-fg-2" lang="ru">
            За горизонтом событий
          </p>
          <p className="text-lg text-fg-2" lang="bg">
            Отвъд хоризонта на събитията
          </p>
          <Link
            href="/"
            className="mt-8 self-start rounded-sm bg-accent px-5 py-2.5 font-medium text-accent-ink focus-ring"
          >
            Veritas Tasks
          </Link>
        </main>
      </body>
    </html>
  );
}
