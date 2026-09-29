'use client';

import {
  ArrowRight,
  Copy,
  Flag,
  FolderInput,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Calendar,
  LayoutGrid,
  List,
  MoreHorizontal,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { GalaxyIcon } from '@/components/brand/icons';
import { Magnetic } from '@/components/effects/magnetic';
import { AvatarGroup, Avatar } from '@/components/ui/avatar';
import { Badge, CountBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu';
import { PasswordInput } from '@/components/ui/password-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectItem } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { StarCheck } from '@/components/ui/star-check';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { priorities } from '@/design/palette';
import { useDeviceSettings } from '@/stores/device-settings';
import { toast } from '@/stores/toasts';
import { Group, Section } from './primitives';

export function ButtonsSection() {
  const t = useTranslations('design');
  return (
    <Section id="buttons" title={t('sections.buttons')}>
      <Group label="variant">
        <Button variant="primary" icon={<Plus />}>
          {t('buttons.primary')}
        </Button>
        <Button variant="secondary">{t('buttons.secondary')}</Button>
        <Button variant="ghost" trailing={<ArrowRight />}>
          {t('buttons.ghost')}
        </Button>
        <Button variant="danger" icon={<Trash2 />}>
          {t('buttons.danger')}
        </Button>
        <Button variant="link">{t('buttons.ghost')}</Button>
      </Group>
      <Group label="size">
        <Button variant="primary" size="sm">
          {t('buttons.primary')}
        </Button>
        <Button variant="primary" size="md">
          {t('buttons.primary')}
        </Button>
        <Button variant="primary" size="lg">
          {t('buttons.primary')}
        </Button>
      </Group>
      <Group label="state">
        <Button variant="primary" loading>
          {t('buttons.loading')}
        </Button>
        <Button variant="secondary" loading>
          {t('buttons.loading')}
        </Button>
        <Button variant="primary" disabled>
          {t('buttons.disabled')}
        </Button>
        <Button variant="secondary" disabled>
          {t('buttons.disabled')}
        </Button>
        <Magnetic>
          <Button variant="primary" size="lg" trailing={<ArrowRight />}>
            {t('buttons.magnetic')}
          </Button>
        </Magnetic>
      </Group>
      <Group label="icon">
        <IconButton label={t('inputs.search')} icon={<Search />} shortcut={['/']} />
        <IconButton
          label={t('overlays.menuEdit')}
          icon={<Pencil />}
          variant="secondary"
          shortcut={['E']}
        />
        <IconButton
          label={t('buttons.primary')}
          icon={<Plus />}
          variant="primary"
          shortcut={['N']}
        />
        <IconButton label={t('buttons.danger')} icon={<Trash2 />} variant="danger" />
        <IconButton label={t('buttons.loading')} icon={<Plus />} loading />
        <IconButton label={t('buttons.disabled')} icon={<Plus />} disabled />
        <IconButton label={t('buttons.primary')} icon={<Plus />} variant="primary" size="lg" />
        <IconButton label={t('buttons.primary')} icon={<Plus />} size="sm" />
      </Group>
    </Section>
  );
}

export function InputsSection() {
  const t = useTranslations('design.inputs');
  const td = useTranslations('design');
  const tc = useTranslations('common');
  const to = useTranslations('design.overlays');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('orbit-Kometa-2026');
  const [priority, setPriority] = useState('high');
  return (
    <Section id="inputs" title={td('sections.inputs')}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field label={t('title')} hint={t('hint')}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </Field>
        <Field label={t('search')} hideLabel>
          <Input
            prefix={<Search />}
            placeholder={t('search')}
            suffix={<Kbd>/</Kbd>}
            type="search"
          />
        </Field>
        <Field label={t('email')} error={t('emailError')}>
          <Input defaultValue="alex@veritas" type="email" />
        </Field>
        <Field label={t('username')} success={t('usernameOk')}>
          <Input defaultValue="alex_orbit" prefix={<span className="text-fg-3">@</span>} />
        </Field>
        <Field label={t('password')}>
          <PasswordInput meter value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('disabled')} disabled>
          <Input defaultValue="VT-4F9K2" />
        </Field>
        <Field label={t('description')} optional={tc('optional')}>
          <Textarea placeholder={t('descriptionPlaceholder')} />
        </Field>
        <Field label={to('select')}>
          <Select value={priority} onValueChange={setPriority}>
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
              <SelectItem key={p} value={p} icon={<Flag style={{ color: priorities[p] }} />}>
                {to(p)}
              </SelectItem>
            ))}
          </Select>
        </Field>
      </div>
    </Section>
  );
}

export function ChoiceSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.choice');
  const [checked, setChecked] = useState(true);
  const [stars, setStars] = useState<Record<string, boolean>>({
    critical: true,
    high: false,
    medium: true,
    low: false,
  });
  const [repeat, setRepeat] = useState('weekdays');
  const [sound, setSound] = useState(true);
  const [ambient, setAmbient] = useState(false);
  const [progress, setProgress] = useState([64]);
  const [view, setView] = useState<'list' | 'board' | 'calendar' | 'galaxy'>('list');
  const [tab, setTab] = useState('list');

  return (
    <Section id="choice" title={td('sections.choice')}>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <Group label="checkbox" className="flex-col items-start">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            label={t('checkbox')}
          />
          <Checkbox checked="indeterminate" label={t('checkbox')} />
          <Checkbox disabled label={t('checkboxDisabled')} />
        </Group>
        <Group label="star-check">
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
            <StarCheck
              key={p}
              checked={!!stars[p]}
              onCheckedChange={(v) => setStars((s) => ({ ...s, [p]: v }))}
              color={priorities[p]}
              label={`${t('star')} (${p})`}
            />
          ))}
          <StarCheck checked={false} onCheckedChange={() => undefined} label={t('star')} />
          <StarCheck checked={false} onCheckedChange={() => undefined} label={t('star')} disabled />
        </Group>
        <Group label="radio">
          <RadioGroup value={repeat} onValueChange={setRepeat} aria-label={t('radioLabel')}>
            <RadioItem value="daily" label={t('radioDaily')} />
            <RadioItem value="weekdays" label={t('radioWeekdays')} />
            <RadioItem value="custom" label={t('radioCustom')} disabled />
          </RadioGroup>
        </Group>
        <Group label="switch" className="w-full flex-col items-stretch">
          <Switch checked={sound} onCheckedChange={setSound} label={t('switchSound')} />
          <Switch checked={ambient} onCheckedChange={setAmbient} label={t('switchAmbient')} />
          <Switch disabled label={t('switchAmbient')} />
        </Group>
        <Group label="slider" className="w-full">
          <div className="flex w-full items-center gap-5">
            <Slider
              value={progress}
              onValueChange={setProgress}
              max={100}
              step={1}
              label={t('slider')}
              formatValue={(v) => `${v}%`}
            />
            <span className="w-12 text-right font-mono tabular text-sm text-fg">
              {progress[0]}%
            </span>
          </div>
        </Group>
        <Group label="segmented">
          <Segmented
            value={view}
            onValueChange={setView}
            label={t('segmentedLabel')}
            options={[
              { value: 'list', label: t('list'), icon: <List /> },
              { value: 'board', label: t('board'), icon: <LayoutGrid /> },
              { value: 'calendar', label: t('calendar'), icon: <Calendar /> },
              { value: 'galaxy', label: t('galaxy'), icon: <GalaxyIcon /> },
            ]}
          />
        </Group>
      </div>
      <Group label="tabs" className="block w-full">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="list">{t('list')}</TabsTrigger>
            <TabsTrigger value="board">{t('board')}</TabsTrigger>
            <TabsTrigger value="calendar">{t('calendar')}</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="pt-4 text-sm text-fg-2">
            {t(tab as 'list')}
          </TabsContent>
        </Tabs>
      </Group>
    </Section>
  );
}

export function OverlaysSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.overlays');
  const [showDone, setShowDone] = useState(true);
  return (
    <Section id="overlays" title={td('sections.overlays')}>
      <Group label="menu · tooltip · popover">
        <Menu>
          <MenuTrigger asChild>
            <Button icon={<MoreHorizontal />}>{t('menu')}</Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>{t('menu')}</MenuLabel>
            <MenuItem icon={<Pencil />} shortcut={['E']}>
              {t('menuEdit')}
            </MenuItem>
            <MenuItem icon={<Copy />} shortcut={['⌘', 'D']}>
              {t('menuDuplicate')}
            </MenuItem>
            <MenuSub>
              <MenuSubTrigger icon={<Flag />}>{t('menuPriority')}</MenuSubTrigger>
              <MenuSubContent>
                {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                  <MenuItem key={p} icon={<Flag style={{ color: priorities[p] }} />}>
                    {t(p)}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuItem icon={<FolderInput />} shortcut={['M']}>
              {t('menuMove')}
            </MenuItem>
            <MenuCheckboxItem checked={showDone} onCheckedChange={setShowDone}>
              {t('menuDuplicate')}
            </MenuCheckboxItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} tone="danger" shortcut={['Del']}>
              {t('menuDelete')}
            </MenuItem>
          </MenuContent>
        </Menu>
        <Tooltip content={t('tooltip')} shortcut={['⌘', 'K']}>
          <Button variant="ghost">{t('tooltip')}</Button>
        </Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <Button icon={<SlidersHorizontal />}>{t('popover')}</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-base font-medium text-fg">{t('popover')}</p>
            <p className="mt-1.5 text-sm text-fg-2">{t('popoverText')}</p>
          </PopoverContent>
        </Popover>
      </Group>
    </Section>
  );
}

export function DialogsSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.dialogs');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <Section id="dialogs" title={td('sections.dialogs')}>
      <Group label="dialog · sheet">
        <Dialog
          open={open}
          onOpenChange={setOpen}
          trigger={<Button>{t('open')}</Button>}
          title={t('title')}
          description={t('text')}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(false)}>
                {t('confirm')}
              </Button>
            </>
          }
        />
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          trigger={<Button>{t('sheet')}</Button>}
          title={t('sheetTitle')}
          description={t('sheetText')}
          footer={
            <Button variant="primary" size="lg" block onClick={() => setSheet(false)}>
              {tc('done')}
            </Button>
          }
        />
      </Group>
    </Section>
  );
}

export function ToastsSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.toasts');
  const tc = useTranslations('common');
  const tt = useTranslations('toast');
  return (
    <Section id="toasts" title={td('sections.toasts')}>
      <Group label="toast">
        <Button onClick={() => toast.success(t('success'), { description: t('successDetail') })}>
          {t('info')}
        </Button>
        <Button
          onClick={() =>
            toast.undo(t('undoText'), tc('undo'), () => {
              toast.info(tt('undone'));
            })
          }
        >
          {t('undo')}
        </Button>
        <Button onClick={() => toast.warning(t('warningText'))}>{t('warning')}</Button>
        <Button onClick={() => toast.error(t('errorText'))}>{t('error')}</Button>
      </Group>
    </Section>
  );
}

export function IdentitySection() {
  const td = useTranslations('design');
  const tc = useTranslations('common');
  const t = useTranslations('design.identity');
  const [chips, setChips] = useState(['sport', 'home', 'work']);
  const [selected, setSelected] = useState('sport');
  const labels: Record<string, string> = {
    sport: t('chipSport'),
    home: t('chipHome'),
    work: t('chipWork'),
  };
  const colors: Record<string, string> = { sport: '#6bf0b8', home: '#ffb547', work: '#8c9bff' };
  return (
    <Section id="identity" title={td('sections.identity')}>
      <Group label="avatar">
        <Avatar name="Алекс Орлов" size={48} online onlineLabel={t('online')} />
        <Avatar name="Мария Звездина" size={40} />
        <Avatar name="Ivan Petrov" size={32} online onlineLabel={t('online')} />
        <Avatar name="Надя" size={28} />
        <AvatarGroup
          people={[
            { name: 'Алекс Орлов' },
            { name: 'Мария Звездина' },
            { name: 'Ivan Petrov' },
            { name: 'Елена' },
            { name: 'Борис' },
            { name: 'Deyan' },
          ]}
          size={32}
        />
      </Group>
      <Group label={t('badges')}>
        <Badge>neutral</Badge>
        <Badge tone="accent">accent</Badge>
        <Badge tone="success">+15 XP</Badge>
        <Badge tone="warning">1 ч</Badge>
        <Badge tone="danger">!</Badge>
        <Badge tone="info">info</Badge>
        <CountBadge count={7} />
        <CountBadge count={128} />
      </Group>
      <Group label={t('chips')}>
        {chips.map((c) => (
          <Chip
            key={c}
            color={colors[c]}
            selected={selected === c}
            onClick={() => setSelected(c)}
            onRemove={() => setChips((all) => all.filter((x) => x !== c))}
            removeLabel={`${tc('delete')} ${labels[c]}`}
          >
            #{labels[c]}
          </Chip>
        ))}
      </Group>
      <Group label={t('kbd')}>
        <Kbd>N</Kbd>
        <Kbd>/</Kbd>
        <span className="flex gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
        <Kbd>?</Kbd>
        <Kbd>Esc</Kbd>
      </Group>
    </Section>
  );
}

export function ProgressSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.progress');
  const [value, setValue] = useState(0.64);
  return (
    <Section id="progress" title={td('sections.progress')}>
      <Group label={t('ring')}>
        <ProgressRing value={0.18} />
        <ProgressRing value={value} size={72} stroke={6} />
        <ProgressRing value={1} size={72} stroke={6} color="var(--color-success)" />
        <ProgressRing value={0.4} size={96} stroke={7} color={priorities.critical}>
          <span className="flex flex-col items-center leading-none">
            <span className="font-mono tabular text-xl text-fg">12</span>
            <span className="mt-1 text-xs text-fg-3">/ 30</span>
          </span>
        </ProgressRing>
        <Button size="sm" onClick={() => setValue((v) => (v >= 1 ? 0.1 : Math.min(1, v + 0.15)))}>
          +15%
        </Button>
      </Group>
      <Group label={t('bar')} className="w-full max-w-lg flex-col items-stretch">
        <ProgressBar value={0.32} />
        <ProgressBar value={value} />
        <ProgressBar value={0.9} color="var(--color-success)" />
        <p className="text-sm text-fg-2">
          {t('tasks', { count: 21 })} · {t('tasks', { count: 3 })} · {t('tasks', { count: 1 })}
        </p>
      </Group>
    </Section>
  );
}

export function LoadingSection() {
  const td = useTranslations('design');
  return (
    <Section id="loading" title={td('sections.loading')}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface-1">
          {[0.62, 0.44, 0.75, 0.38].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-[22px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <span className="sr-only">{w}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 text-accent">
          <Spinner size={16} />
          <Spinner size={24} />
          <Spinner size={36} />
        </div>
      </div>
    </Section>
  );
}

export function EmptySection() {
  const td = useTranslations('design');
  const t = useTranslations('design.empty');
  return (
    <Section id="empty" title={td('sections.empty')}>
      <Surface className="py-4">
        <EmptyState
          title={t('title')}
          description={t('text')}
          action={
            <Button variant="primary" icon={<Plus />}>
              {t('action')}
            </Button>
          }
        />
      </Surface>
    </Section>
  );
}

export function EffectsSection() {
  const td = useTranslations('design');
  const t = useTranslations('design.effects');
  const cursor = useDeviceSettings((s) => s.cursor);
  const motionMode = useDeviceSettings((s) => s.motion);
  const set = useDeviceSettings((s) => s.set);
  return (
    <Section id="effects" title={td('sections.effects')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Surface spotlight interactive className="min-h-40 p-6">
          <p className="relative text-base font-medium text-fg">{t('spotlight')}</p>
          <p className="relative mt-2 text-sm text-fg-2">{t('spotlightText')}</p>
        </Surface>
        <Surface className="flex flex-col gap-5 p-6">
          <Switch
            checked={cursor === 'custom'}
            onCheckedChange={(v) => set('cursor', v ? 'custom' : 'system')}
            label={t('cursor')}
            description={t('cursorHint')}
          />
          <Switch
            checked={motionMode === 'reduced'}
            onCheckedChange={(v) => set('motion', v ? 'reduced' : 'system')}
            label={t('reduced')}
            description={t('reducedHint')}
          />
          <p className="text-sm text-fg-3">{t('grain')}</p>
        </Surface>
      </div>
    </Section>
  );
}
