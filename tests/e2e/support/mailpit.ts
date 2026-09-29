/** Reads the local test inbox (Mailpit, started by `supabase start`). */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface Summary {
  ID: string;
  Subject: string;
  Created: string;
}

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

export async function waitForMail(to: string, { after = 0, timeout = 30_000 } = {}): Promise<Mail> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=10`);
    const body = (await res.json()) as { messages: Summary[] };
    const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= after);
    if (fresh) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as {
        Subject: string;
        HTML: string;
        Text: string;
      };
      return { subject: full.Subject, html: full.HTML, text: full.Text };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to} within ${timeout} ms`);
}

/** First link in the email whose URL contains `needle`. */
export function linkFrom(mail: Mail, needle: string): string {
  const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
  const link = hrefs.find((h) => h.includes(needle));
  if (!link) throw new Error(`No link containing "${needle}" in: ${mail.subject}`);
  return link;
}

/** Six-digit code (reauthentication emails). */
export function codeFrom(mail: Mail): string {
  const match = /\b(\d{6})\b/.exec(mail.text || mail.html.replace(/<[^>]+>/g, ' '));
  if (!match) throw new Error(`No code in: ${mail.subject}`);
  return match[1]!;
}
