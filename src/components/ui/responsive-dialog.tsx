'use client';

import type { ComponentProps } from 'react';
import { useIsPhone } from '@/lib/hooks/use-media-query';
import { Dialog } from './dialog';
import { Sheet } from './sheet';

type Props = ComponentProps<typeof Dialog>;

/** A dialog on larger screens, a bottom sheet on phones. Same content either way. */
export function ResponsiveDialog({ size: _size, ...props }: Props) {
  const phone = useIsPhone();
  return phone ? <Sheet {...props} /> : <Dialog size={_size} {...props} />;
}
