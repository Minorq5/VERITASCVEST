'use client';

import { useTranslations } from 'next-intl';
import { ProgressRing } from '@/components/ui/progress';
import { typeMeta } from '../shared/type-meta';
import { AbstainWidget, CollabWidget } from './collab-abstain';
import { CounterWidget } from './counter-widget';
import { HabitWidget } from './habit-widget';
import { MilestonesWidget } from './milestones-widget';
import { NumericWidget } from './numeric-widget';
import { PercentWidget } from './percent-widget';
import { WidgetCard, type WidgetProps } from './shared';
import { TimeWidget } from './time-widget';

function SubtasksSummary({ progress }: WidgetProps) {
  const t = useTranslations('tasks');
  const d = progress.detail.kind === 'subtasks' ? progress.detail : { done: 0, total: 0 };
  return (
    <WidgetCard accent={typeMeta.subtasks.color} className="flex items-center gap-4">
      <ProgressRing value={progress.ratio} size={64} stroke={6} color={progress.reached ? 'var(--color-success)' : typeMeta.subtasks.color} />
      <p className="text-base text-fg-2">{d.total ? t('widgets.subtasks.of', d) : t('widgets.subtasks.empty')}</p>
    </WidgetCard>
  );
}

/** The type's own controls at the top of the task. Simple tasks have none. */
export function TypeWidget(props: WidgetProps) {
  switch (props.task.type) {
    case 'percent':
      return <PercentWidget {...props} />;
    case 'numeric':
      return <NumericWidget {...props} />;
    case 'subtasks':
      return <SubtasksSummary {...props} />;
    case 'time':
      return <TimeWidget {...props} />;
    case 'habit':
      return <HabitWidget {...props} />;
    case 'counter':
      return <CounterWidget {...props} />;
    case 'stages':
    case 'chain':
      return <MilestonesWidget {...props} />;
    case 'collab':
      return <CollabWidget {...props} />;
    case 'abstain':
      return <AbstainWidget {...props} />;
    default:
      return null;
  }
}
