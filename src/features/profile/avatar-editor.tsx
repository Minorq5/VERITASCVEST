'use client';

import { Camera, ImageUp, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Slider } from '@/components/ui/slider';
import { useUpdateProfile, type Profile } from '@/features/account/queries';
import { authErrorKey } from '@/lib/auth/errors';
import { AVATAR_INPUT_TYPES, avatarPath, checkAvatarInput, renderAvatar } from '@/lib/image/avatar';
import { avatarUrl, getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toasts';

const BUCKET = 'avatars';

export function AvatarEditor({ profile, size = 112 }: { profile: Profile; size?: number }) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const updateProfile = useUpdateProfile();

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  function pick(file: File | undefined) {
    if (!file) return;
    const problem = checkAvatarInput(file);
    if (problem) {
      toast.error(t(`profile.avatar.${problem}`));
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setSource(URL.createObjectURL(file));
  }

  async function apply() {
    if (!source || !area) return;
    setBusy(true);
    const previous = profile.avatar_path;
    try {
      const blob = await renderAvatar(source, area);
      const path = avatarPath(profile.id, blob.type);
      const storage = getSupabase().storage.from(BUCKET);
      const { error } = await storage.upload(path, blob, {
        contentType: blob.type,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      await updateProfile.mutateAsync({ avatar_path: path });
      if (previous) void storage.remove([previous]);
      setSource(null);
      toast.success(t('profile.avatar.saved'));
    } catch (error) {
      toast.error(t(`auth.errors.${authErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const previous = profile.avatar_path;
    if (!previous) return;
    try {
      await updateProfile.mutateAsync({ avatar_path: null });
      void getSupabase().storage.from(BUCKET).remove([previous]);
      toast.success(t('profile.avatar.removed'));
    } catch (error) {
      toast.error(t(`auth.errors.${authErrorKey(error)}`));
    }
  }

  const openPicker = () => inputRef.current?.click();
  const badge = (
    <span
      aria-hidden
      className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface-3 text-fg-2 transition-colors group-hover/avatar:bg-surface-4 group-hover/avatar:text-fg [&_svg]:size-4"
    >
      <Camera />
    </span>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_INPUT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {profile.avatar_path ? (
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="group/avatar relative rounded-full focus-ring"
              aria-label={t('profile.avatar.change')}
            >
              <Avatar
                name={profile.display_name}
                src={avatarUrl(profile.avatar_path)}
                size={size}
              />
              {badge}
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem icon={<ImageUp />} onSelect={openPicker}>
              {t('profile.avatar.upload')}
            </MenuItem>
            <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => void remove()}>
              {t('profile.avatar.remove')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="group/avatar relative rounded-full focus-ring"
          aria-label={t('profile.avatar.upload')}
        >
          <Avatar name={profile.display_name} size={size} />
          {badge}
        </button>
      )}

      <ResponsiveDialog
        open={source !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSource(null);
        }}
        title={t('profile.avatar.cropTitle')}
        description={t('profile.avatar.cropText')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSource(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void apply()} disabled={!area}>
              {busy ? t('profile.avatar.uploading') : t('profile.avatar.apply')}
            </Button>
          </>
        }
      >
        {source && (
          <div className="flex flex-col gap-5">
            <div
              data-vaul-no-drag
              className={cn(
                'relative aspect-square w-full overflow-hidden rounded-md bg-void',
                busy && 'pointer-events-none opacity-70',
              )}
            >
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={4}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit="cover"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setArea(pixels)}
                style={{
                  cropAreaStyle: {
                    border: '2px solid var(--accent)',
                    boxShadow: '0 0 0 9999px rgb(2 2 3 / 0.72)',
                  },
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="label-mono">{t('profile.avatar.zoom')}</span>
              <Slider
                label={t('profile.avatar.zoom')}
                min={1}
                max={4}
                step={0.01}
                value={[zoom]}
                onValueChange={([z]) => setZoom(z ?? 1)}
              />
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </>
  );
}
