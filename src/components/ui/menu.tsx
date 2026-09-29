'use client';

import { Check, ChevronRight } from 'lucide-react';
import { DropdownMenu as M } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Kbd } from './kbd';
import { panelSurface } from './popover';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuSub = M.Sub;
export const MenuRadioGroup = M.RadioGroup;

const itemBase = cn(
  'relative flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-base text-fg-2 outline-none select-none',
  'transition-colors duration-100 data-[highlighted]:bg-surface-4 data-[highlighted]:text-fg',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
);

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          panelSurface,
          'overlay-anim z-[var(--z-dropdown)] min-w-56 p-1.5 outline-none',
          'origin-[var(--radix-dropdown-menu-content-transform-origin)]',
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

interface MenuItemProps extends ComponentPropsWithoutRef<typeof M.Item> {
  icon?: ReactNode;
  shortcut?: string[];
  tone?: 'default' | 'danger';
}

export function MenuItem({
  icon,
  shortcut,
  tone = 'default',
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <M.Item
      className={cn(
        itemBase,
        tone === 'danger' &&
          'text-danger data-[highlighted]:bg-danger/12 data-[highlighted]:text-danger',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="ml-4 flex gap-0.5">
          {shortcut.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
      )}
    </M.Item>
  );
}

export function MenuCheckboxItem({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <M.ItemIndicator className="absolute left-2.5 inline-flex text-accent">
        <Check />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export function MenuRadioItem({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <M.ItemIndicator className="absolute left-3 inline-flex">
        <span className="size-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
      </M.ItemIndicator>
      {children}
    </M.RadioItem>
  );
}

export function MenuSubTrigger({
  icon,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof M.SubTrigger> & { icon?: ReactNode }) {
  return (
    <M.SubTrigger
      className={cn(
        itemBase,
        'data-[state=open]:bg-surface-4 data-[state=open]:text-fg',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="text-fg-3" />
    </M.SubTrigger>
  );
}

export function MenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          panelSurface,
          'overlay-anim z-[var(--z-dropdown)] min-w-48 p-1.5 outline-none',
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof M.Label>) {
  return <M.Label className={cn('px-2.5 pt-2 pb-1 eyebrow', className)} {...props} />;
}

export function MenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof M.Separator>) {
  return <M.Separator className={cn('mx-1 my-1.5 h-px bg-line', className)} {...props} />;
}
