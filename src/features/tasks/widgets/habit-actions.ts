import type { TaskRow } from '@/lib/db/types';
import type { IsoDate } from '@/lib/time/dates';
import { sound } from '@/sound/engine';
import { setHabitDay } from '../data/actions';
import type { TaskActions } from '../data/use-task-actions';

/** Marks a habit day (or clears the mark) as one undoable step. */
export async function markHabitDay(
  actions: TaskActions,
  task: Pick<TaskRow, 'id'>,
  date: IsoDate,
  status: 'done' | 'skip' | 'freeze' | 'fail' | null,
  label: string,
) {
  const inverse = await setHabitDay(actions.ctx, task.id, date, status);
  if (status === 'done') sound.play('completeMedium');
  actions.record(label, inverse);
}
