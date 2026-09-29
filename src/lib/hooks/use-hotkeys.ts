'use client';

import { useEffect, useRef } from 'react';

/** True while the person types: shortcuts must not steal their letters. */
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(type);
  }
  return Boolean(target.closest('[role="dialog"] input, [role="dialog"] textarea'));
}

/** An open dialog, menu or sheet owns the keyboard. */
export function overlayOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="alertdialog"]'));
}

/**
 * Global keydown handler. The latest callback is always used, so handlers can
 * read fresh state without re-subscribing.
 */
export function useKeydown(handler: (event: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => ref.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
