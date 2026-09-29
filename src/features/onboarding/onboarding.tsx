'use client';

import { ArrowLeft, ArrowRight, CircleCheckBig, Rocket, Volume2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { LogoLockup } from '@/components/brand/logo';
import { StarBurst } from '@/components/effects/star-burst';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ChoiceCard, ChoiceCards } from '@/components/ui/choice-cards';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { QualityChoice } from '@/features/account/quality-choice';
import { useProfile, useSettings, useUpdateProfile, useUpdateSettings } from '@/features/account/queries';
import { useSetLocale } from '@/features/account/use-set-locale';
import { QuickAdd } from '@/features/tasks/quick-add/quick-add';
import { useRawMessage } from '@/features/tasks/shared/use-words';
import { authErrorKey } from '@/lib/auth/errors';
import { displayNameSchema } from '@/lib/auth/validation';
import { useRouter } from '@/i18n/navigation';
import { localeNames, routing, type AppLocale } from '@/i18n/routing';
import { APP_HOME } from '@/lib/config/routes';
import { useRecommendedQuality } from '@/lib/graphics/use-recommended-quality';
import { ease } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { sound } from '@/sound/engine';
import { useDeviceSettings } from '@/stores/device-settings';
import { toast } from '@/stores/toasts';

const STEPS = ['welcome', 'graphics', 'sound', 'task'] as const;

/**
 * First flight: language, graphics, sound and the first task, in about a
 * minute. Ends with a small celebration.
 */
export function Onboarding() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const profile = useProfile().data;
  const settings = useSettings().data;
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const { setLocale, pending: localePending } = useSetLocale();
  const quality = useDeviceSettings((s) => s.quality);
  const setDevice = useDeviceSettings((s) => s.set);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const recommended = useRecommendedQuality();
  // Sound choices start from the account and stay local until "Start".
  const [soundDraft, setSoundDraft] = useState<{ on?: boolean; volume?: number }>({});
  const soundOn = soundDraft.on ?? settings?.sound_enabled ?? true;
  const volume = soundDraft.volume ?? settings?.sound_volume ?? 0.8;
  const setSoundOn = (on: boolean) => setSoundDraft((d) => ({ ...d, on }));
  const setVolume = (v: number) => setSoundDraft((d) => ({ ...d, volume: v }));
  const [nameDraft, setNameDraft] = useState<string>();
  const [finishing, setFinishing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [firstTask, setFirstTask] = useState<string | null>(null);
  const [example, setExample] = useState<{ text: string; n: number } | null>(null);
  const examples = useRawMessage<string[]>('tasks', 'quickAdd.examples');
  const headingId = useId();
  const graphicsTextId = useId();

  // Everything the person hears here already follows their choice.
  useEffect(() => {
    sound.configure({ enabled: soundOn, volume });
  }, [soundOn, volume]);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
    sound.play('click');
  };

  async function finish(skipped: boolean) {
    if (finishing) return;
    setFinishing(true);
    try {
      const name = displayNameSchema.safeParse(nameDraft ?? '');
      if (!skipped && name.success && profile && name.data !== profile.display_name) {
        await updateProfile.mutateAsync({ display_name: name.data });
      }
      await updateSettings.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
        ...(skipped ? {} : { sound_enabled: soundOn, sound_volume: volume }),
      });
      if (!skipped) {
        sound.play('success');
        setCelebrate(true);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      router.replace(APP_HOME);
    } catch (error) {
      setFinishing(false);
      toast.error(t(`auth.errors.${authErrorKey(error)}`));
    }
  }

  const current = STEPS[step]!;
  const nameValue = nameDraft ?? profile?.display_name ?? '';
  const name = nameValue.trim() || profile?.display_name || '';

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6 sm:pb-10">
      <header className="flex items-center justify-between">
        <LogoLockup size="sm" />
        <Button variant="ghost" size="sm" onClick={() => void finish(true)} disabled={finishing}>
          {t('onboarding.skip')}
        </Button>
      </header>

      <div className="mt-8 flex items-center gap-3 sm:mt-14">
        <ol className="flex flex-1 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-5">
              <span
                className={cn(
                  'block h-full rounded-full bg-accent transition-[width] duration-500 ease-out-expo',
                  i <= step ? 'w-full shadow-[0_0_10px_var(--accent)]' : 'w-0',
                )}
              />
            </li>
          ))}
        </ol>
        <p className="shrink-0 font-mono text-xs text-fg-3 tabular" aria-live="polite">
          {t('onboarding.stepOf', { current: step + 1, total: STEPS.length })}
        </p>
      </div>

      <section
        aria-labelledby={headingId}
        className="glass-strong relative mt-5 flex-1 overflow-hidden rounded-2xl border border-line-strong shadow-xl shadow-inset-top sm:flex-none"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.32, ease: ease.outExpo }}
            className="p-6 sm:p-8"
          >
            {current === 'welcome' && (
              <>
                <h1 id={headingId} className="font-display text-xl leading-tight font-semibold text-balance text-fg sm:text-2xl">
                  {t('onboarding.welcome.title', { name })}
                </h1>
                <p className="mt-2 text-base text-fg-2">{t('onboarding.welcome.text')}</p>
                <p className="eyebrow mt-7 mb-3">{t('onboarding.welcome.language')}</p>
                <ChoiceCards
                  value={locale}
                  aria-label={t('onboarding.welcome.language')}
                  onValueChange={(next) => {
                    sound.play('click');
                    setLocale(next as AppLocale).catch((error: unknown) =>
                      toast.error(t(`auth.errors.${authErrorKey(error)}`)),
                    );
                  }}
                  disabled={localePending}
                >
                  {routing.locales.map((l) => (
                    <ChoiceCard
                      key={l}
                      value={l}
                      lang={l}
                      media={
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-3 font-mono text-xs font-semibold tracking-wider text-fg-2 uppercase">
                          {l}
                        </span>
                      }
                      label={localeNames[l]}
                    />
                  ))}
                </ChoiceCards>
                <Field label={t('onboarding.welcome.name')} className="mt-6">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={60}
                    autoComplete="nickname"
                  />
                </Field>
              </>
            )}

            {current === 'graphics' && (
              <>
                <h1 id={headingId} className="font-display text-xl leading-tight font-semibold text-fg sm:text-2xl">
                  {t('onboarding.graphics.title')}
                </h1>
                <p id={graphicsTextId} className="mt-2 text-base text-fg-2">
                  {t('onboarding.graphics.text', { quality: t(`quality.${recommended ?? 'high'}`) })}
                </p>
                <div className="mt-6">
                  <QualityChoice
                    value={quality}
                    recommended={recommended}
                    describedBy={graphicsTextId}
                    onChange={(q) => {
                      sound.play('click');
                      setDevice('quality', q);
                    }}
                  />
                </div>
              </>
            )}

            {current === 'sound' && (
              <>
                <h1 id={headingId} className="font-display text-xl leading-tight font-semibold text-fg sm:text-2xl">
                  {t('onboarding.sound.title')}
                </h1>
                <p className="mt-2 text-base text-fg-2">{t('onboarding.sound.text')}</p>
                <div className="mt-7 flex flex-col gap-6">
                  <Switch
                    label={t('settings.sound.enabled')}
                    checked={soundOn}
                    onCheckedChange={(on) => {
                      setSoundOn(on);
                      if (on) {
                        sound.configure({ enabled: true });
                        sound.play('toggleOn');
                      }
                    }}
                  />
                  <div className={cn('flex flex-col gap-3', !soundOn && 'opacity-45')}>
                    <span className="text-base text-fg">{t('settings.sound.volume')}</span>
                    <Slider
                      label={t('settings.sound.volume')}
                      min={0}
                      max={100}
                      step={5}
                      disabled={!soundOn}
                      value={[Math.round(volume * 100)]}
                      formatValue={(v) => `${v}%`}
                      onValueChange={([v]) => setVolume((v ?? 80) / 100)}
                      onValueCommit={() => sound.play('click')}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Volume2 />}
                    disabled={!soundOn}
                    onClick={() => {
                      sound.play('chime');
                      window.setTimeout(() => sound.play('success'), 420);
                    }}
                    className="self-start"
                  >
                    {t('onboarding.sound.test')}
                  </Button>
                  <p className="text-sm text-fg-3">{t('settings.sound.iosHint')}</p>
                </div>
              </>
            )}

            {current === 'task' && (
              <>
                <h1 id={headingId} className="font-display text-xl leading-tight font-semibold text-fg sm:text-2xl">
                  {t('onboarding.task.title')}
                </h1>
                <p className="mt-2 text-base text-fg-2">{t('onboarding.task.text')}</p>
                <div className="mt-6">
                  <QuickAdd
                    key={example?.n ?? 0}
                    scope={{ kind: 'section', section: 'today' }}
                    defaultText={example?.text}
                    autoFocus
                    onCreated={(task) => {
                      setFirstTask(task.title);
                      sound.play('success');
                    }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-fg-3">{t('onboarding.task.examples')}</span>
                  {examples.slice(0, 3).map((text, i) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => setExample({ text, n: i + 1 + (example?.n ?? 0) * 10 })}
                      className="focus-ring rounded-full border border-line-strong bg-surface-3/70 px-3 py-1 text-sm text-fg-2 transition-colors hover-ok:border-line-bright hover-ok:text-fg"
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {firstTask && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-base text-fg"
                      role="status"
                    >
                      <CircleCheckBig aria-hidden className="size-5 shrink-0 text-success" />
                      {t('onboarding.task.created', { title: firstTask })}
                    </motion.p>
                  )}
                </AnimatePresence>
                {!firstTask && <p className="mt-5 text-sm text-fg-3">{t('onboarding.task.skipHint')}</p>}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* On phones the actions stay under the thumb while the step scrolls. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex items-center justify-between gap-3 bg-[linear-gradient(to_top,var(--color-bg)_55%,transparent)] px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-none sm:p-0">
        <Button variant="ghost" icon={<ArrowLeft />} onClick={() => go(-1)} className={cn(step === 0 && 'invisible')} disabled={finishing}>
          {t('common.back')}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" size="lg" trailing={<ArrowRight />} onClick={() => go(1)} disabled={localePending}>
            {t('common.next')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon={<Rocket />} loading={finishing} onClick={() => void finish(false)}>
            {finishing ? t('onboarding.saving') : t('onboarding.finish')}
          </Button>
        )}
      </div>
      {celebrate && <StarBurst />}
    </div>
  );
}
