'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface FieldContextValue {
  id: string;
  hintId?: string;
  messageId?: string;
  invalid: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Wires label, hint and message to the control via ids and aria attributes. */
export function useField() {
  return useContext(FieldContext);
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  success?: ReactNode;
  optional?: string;
  disabled?: boolean;
  className?: string;
  /** Render the label visually hidden (the control still has a name). */
  hideLabel?: boolean;
  children: ReactNode;
  id?: string;
}

export function Field({
  label,
  hint,
  error,
  success,
  optional,
  disabled = false,
  className,
  hideLabel,
  children,
  id: idProp,
}: FieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const message = error ?? success;
  const messageId = message ? `${id}-msg` : undefined;

  return (
    <FieldContext.Provider value={{ id, hintId, messageId, invalid: !!error, disabled }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={id}
          className={cn(
            'flex items-baseline justify-between gap-3 text-sm font-medium text-fg-2',
            hideLabel && 'sr-only',
          )}
        >
          <span>{label}</span>
          {optional && <span className="text-xs font-normal text-fg-3">{optional}</span>}
        </label>
        {children}
        {hint && !message && (
          <p id={hintId} className="text-sm text-fg-3">
            {hint}
          </p>
        )}
        {message && (
          <p
            id={messageId}
            role={error ? 'alert' : 'status'}
            className={cn(
              'flex items-start gap-1.5 text-sm',
              error ? 'text-danger' : 'text-success',
            )}
          >
            {error ? (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{message}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
