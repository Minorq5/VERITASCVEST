import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';

/**
 * Identifiers are created on the device (UUID v7: time-ordered, random tail),
 * so a task made offline already has its final id and a repeated upload is
 * never a duplicate.
 */
export function newId(): string {
  return uuidv7();
}

/** Fixed namespaces for ids derived from their content. */
const NS = {
  taskTag: '6f0c6d2e-3c2f-4a55-9a8d-2b1e0d4c7a10',
  habitDay: '0b8b7f4d-6a0e-4a8e-8e1a-6d9f2c3b5e21',
  tag: 'c7a3e1f2-9b4d-4f6a-8c2e-1d5b7a9e3f32',
} as const;

/**
 * Ids derived from content: the same tag added to the same task on two
 * offline devices becomes one row, not two.
 */
export const stableId = {
  taskTag: (taskId: string, tagId: string) => uuidv5(`${taskId}:${tagId}`, NS.taskTag),
  habitDay: (taskId: string, userId: string, date: string) => uuidv5(`${taskId}:${userId}:${date}`, NS.habitDay),
  tag: (ownerId: string, name: string) => uuidv5(`${ownerId}:${name.trim().toLocaleLowerCase()}`, NS.tag),
};
