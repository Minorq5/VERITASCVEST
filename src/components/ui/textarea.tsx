'use client';

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils/cn';
import { useField } from './field';
import { controlFrame, controlState } from './input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Grow with content up to this many pixels. */
  maxHeight?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, disabled, className, maxHeight = 320, id, onInput, ...props },
  forwardedRef,
) {
  const field = useField();
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled ?? field?.disabled ?? false;

  const resize = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  useLayoutEffect(resize, [resize, props.value]);

  return (
    <div
      className={cn(
        controlFrame,
        'items-start px-3 py-2.5',
        controlState({ invalid: isInvalid, disabled: isDisabled }),
      )}
    >
      <textarea
        ref={(node) => {
          inner.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={id ?? field?.id}
        rows={3}
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={[field?.hintId, field?.messageId].filter(Boolean).join(' ') || undefined}
        onInput={(event) => {
          resize();
          onInput?.(event);
        }}
        className={cn(
          'min-h-[4.5rem] w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-fg-3',
          className,
        )}
        {...props}
      />
    </div>
  );
});
