import type { Task } from '../types';

/** Derived from saved owners so assigning a person immediately clears the flag. */
export function needsOwnerClarification(task: Task): boolean {
  return task.isAiGenerated && taskAssigneeIds(task).length === 0;
}

/** Read new multi-owner tasks and migrate old single-owner records in memory. */
export function taskAssigneeIds(task: Pick<Task, 'assigneeId' | 'assigneeIds'>): string[] {
  const values = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
  return [...new Set(values.filter(Boolean))];
}
