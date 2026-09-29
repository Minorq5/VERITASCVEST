'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { estimatePasswordStrength, type StrengthLevel } from '@/lib/security/password-strength';
import { Input, type InputProps } from './input';

interface PasswordInputProps extends Omit<InputProps, 'type' | 'suffix'> {
  /** Show the strength meter (registration, password change). */
  meter?: boolean;
  /** Words the password should not contain: email, username, name. */
  context?: string[];
}

const levelColor: Record<StrengthLevel, string> = {
  0: 'bg-surface-5',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-info',
  4: 'bg-success',
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ meter = false, context, value, className, ...props }, ref) {
    const t = useTranslations();
    const [visible, setVisible] = useState(false);
    const text = typeof value === 'string' ? value : '';
    const strength = useMemo(() => estimatePasswordStrength(text, context), [text, context]);

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={props.autoComplete ?? (meter ? 'new-password' : 'current-password')}
          spellCheck={false}
          suffix={
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? t('a11y.hidePassword') : t('a11y.showPassword')}
              aria-pressed={visible}
              className="-mr-1 inline-flex size-8 items-center justify-center rounded-sm text-fg-3 focus-ring transition-colors hover-ok:bg-surface-4 hover-ok:text-fg"
            >
              {visible ? <EyeOff /> : <Eye />}
            </button>
          }
          {...props}
        />
        {meter && (
          <div className="flex items-center gap-3" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300 ease-out',
                    strength.level >= segment ? levelColor[strength.level] : 'bg-surface-4',
                  )}
                />
              ))}
            </div>
            <span className="min-w-20 text-right text-sm text-fg-3">
              <span className="sr-only">{t('password.strength.label')}: </span>
              {t(`password.strength.${strength.label}`)}
            </span>
          </div>
        )}
      </div>
    );
  },
);
