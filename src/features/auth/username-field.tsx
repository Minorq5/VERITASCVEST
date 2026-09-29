'use client';

import { AtSign, CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { UsernameStatus } from './use-username-availability';

interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  status: UsernameStatus;
  label: string;
  hint?: string;
  /** A submit-time error (e.g. the name was taken a moment ago). */
  error?: string;
}

export function UsernameField({ value, onChange, status, label, hint, error }: UsernameFieldProps) {
  const t = useTranslations('auth.register.status');
  const statusText =
    status === 'available'
      ? t('available')
      : status === 'taken' || status === 'invalid' || status === 'reserved' || status === 'rateLimited'
        ? t(status)
        : undefined;
  const bad = status === 'taken' || status === 'invalid' || status === 'reserved';

  return (
    <Field
      label={label}
      hint={status === 'checking' ? t('checking') : status === 'error' ? t('error') : hint}
      error={error ?? (bad ? statusText : undefined)}
      success={!error && status === 'available' ? statusText : undefined}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s/g, '').toLowerCase())}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={24}
        prefix={<AtSign />}
        suffix={
          status === 'checking' ? (
            <Spinner size={16} className="text-accent" />
          ) : status === 'available' ? (
            <CircleCheck className="text-success" aria-hidden />
          ) : bad ? (
            <CircleAlert className="text-danger" aria-hidden />
          ) : null
        }
      />
    </Field>
  );
}
