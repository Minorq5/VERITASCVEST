'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useRef } from 'react';
import { bootScript } from '@/lib/boot-script';

/**
 * Puts the device-settings boot script into the server HTML only: it runs
 * while the page is parsed, before the first paint, and the client never
 * renders a <script> element (React warns about those, and they would not
 * run anyway).
 */
export function BootScript() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script id="vt-boot" dangerouslySetInnerHTML={{ __html: bootScript }} />;
  });
  return null;
}
