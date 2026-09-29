'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { Textarea } from '@/components/ui/textarea';
import { useChangeUsername, useUpdateProfile, type Profile } from '@/features/account/queries';
import { useUsernameAvailability } from '@/features/auth/use-username-availability';
import { UsernameField } from '@/features/auth/username-field';
import { authErrorKey } from '@/lib/auth/errors';
import { bioSchema, displayNameSchema, normalizeUsername } from '@/lib/auth/validation';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { toast } from '@/stores/toasts';

const BIO_MAX = 280;

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});
  const updateProfile = useUpdateProfile();
  const changeUsername = useChangeUsername();
  const { pending, run } = useGuardedSubmit();
  const status = useUsernameAvailability(username, profile.username);

  // Another device changed the profile: take the new values for fields not being edited here.
  const [base, setBase] = useState(profile);
  if (profile !== base) {
    setBase(profile);
    if (displayName === base.display_name) setDisplayName(profile.display_name);
    if (username === base.username) setUsername(profile.username);
    if (bio === base.bio) setBio(profile.bio);
  }

  const nextUsername = normalizeUsername(username);
  const usernameChanged = nextUsername !== profile.username;
  const dirty =
    displayName.trim() !== profile.display_name || usernameChanged || bio.trim() !== profile.bio;
  const usernameBlocked = usernameChanged && status !== 'available';

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const name = displayNameSchema.safeParse(displayName);
      if (!name.success) {
        setErrors({ displayName: t('auth.errors.required') });
        return;
      }
      if (!bioSchema.safeParse(bio).success) return;
      setErrors({});
      try {
        if (usernameChanged) await changeUsername.mutateAsync(nextUsername);
        const patch = { display_name: name.data, bio: bio.trim() };
        if (patch.display_name !== profile.display_name || patch.bio !== profile.bio) {
          await updateProfile.mutateAsync(patch);
        }
        toast.success(t('profile.saved'));
      } catch (error) {
        const key = authErrorKey(error);
        if (key === 'usernameTaken' || key === 'invalidUsername') setErrors({ username: t(`auth.errors.${key}`) });
        else toast.error(t(`auth.errors.${key}`));
      }
    });
  }

  return (
    <Surface tone="glass" className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-semibold text-fg">{t('profile.edit')}</h2>
      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
        <Field label={t('profile.displayName')} error={errors.displayName}>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            autoComplete="nickname"
            required
          />
        </Field>
        <UsernameField
          label={t('profile.username')}
          hint={t('profile.usernameHint')}
          value={username}
          onChange={(v) => {
            setUsername(v);
            setErrors((e) => ({ ...e, username: undefined }));
          }}
          status={status}
          error={errors.username}
        />
        <Field label={t('profile.bio')} hint={t('profile.bioCounter', { count: bio.length, max: BIO_MAX })}>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder={t('profile.bioPlaceholder')}
            maxLength={BIO_MAX}
            rows={3}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={pending} disabled={!dirty || usernameBlocked}>
            {t('profile.save')}
          </Button>
        </div>
      </form>
    </Surface>
  );
}
