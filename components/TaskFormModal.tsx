import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Meeting, Priority, Task, TaskStatus } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  /** Provided when editing; omitted when creating. */
  task?: Task | null;
  defaultStatus?: TaskStatus;
  defaultMeetingId?: string;
  meetings: Meeting[];
}

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in-progress', 'review', 'completed'];

const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high'];

interface FormState {
  title: string;
  description: string;
  assigneeId: string;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  meetingId: string;
}

const emptyForm = (status: TaskStatus, meetingId: string): FormState => ({
  title: '',
  description: '',
  assigneeId: '',
  deadline: '',
  priority: 'medium',
  status,
  meetingId,
});

/** Deadlines can arrive from the AI as free text, so only feed real ISO dates to <input type="date">. */
const toDateInput = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  open,
  onClose,
  onSave,
  task,
  defaultStatus,
  defaultMeetingId,
  meetings,
}) => {
  const { team } = useTeam();
  const { t } = useI18n();
  const isEdit = Boolean(task);
  // Written as fallbacks rather than destructuring defaults: with strictNullChecks off,
  // a default literal widens the binding's type from TaskStatus to string.
  const initialStatus: TaskStatus = defaultStatus ?? 'todo';
  const initialMeetingId: string = defaultMeetingId ?? '';
  const [form, setForm] = useState<FormState>(emptyForm(initialStatus, initialMeetingId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assigneeId: task.assigneeId,
            deadline: toDateInput(task.deadline),
            priority: task.priority,
            status: task.status,
            meetingId: task.meetingId,
          }
        : emptyForm(initialStatus, initialMeetingId),
    );
  }, [open, task, initialStatus, initialMeetingId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const meetingOptions = useMemo(
    () => meetings.map((m) => ({ id: m.id, title: m.title })),
    [meetings],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError(t.taskForm.titleRequired);
      return;
    }
    onSave({
      id: task?.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: form.description.trim() || undefined,
      assigneeId: form.assigneeId,
      deadline: form.deadline || 'No deadline',
      priority: form.priority,
      status: form.status,
      meetingId: form.meetingId,
      isAiGenerated: task?.isAiGenerated ?? false,
      // Saving through this form counts as human review, so the AI badge clears.
      isApproved: true,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t.taskForm.editTitle : t.taskForm.newTitle}
      description={isEdit ? t.taskForm.editSubtitle : t.taskForm.newSubtitle}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="task-form"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            {isEdit ? t.taskForm.saveChanges : t.taskForm.createTask}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.taskForm.title} htmlFor="task-title" error={error}>
          <input
            id="task-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t.taskForm.titlePlaceholder}
            className={inputClass}
          />
        </Field>

        <Field label={t.taskForm.description} htmlFor="task-description">
          <textarea
            id="task-description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder={t.taskForm.descriptionPlaceholder}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.taskForm.assignee} htmlFor="task-assignee">
            <select
              id="task-assignee"
              value={form.assigneeId}
              onChange={(e) => set('assigneeId', e.target.value)}
              className={inputClass}
            >
              <option value="">{t.common.unassigned}</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>{u.role ? `${u.name} — ${u.role}` : u.name}</option>
              ))}
            </select>
          </Field>

          <Field label={t.taskForm.deadline} htmlFor="task-deadline">
            <input
              id="task-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label={t.taskForm.priority} htmlFor="task-priority">
            <select
              id="task-priority"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as Priority)}
              className={`${inputClass} capitalize`}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p} className="capitalize">{t.priority[p]}</option>
              ))}
            </select>
          </Field>

          <Field label={t.taskForm.status} htmlFor="task-status">
            <select
              id="task-status"
              value={form.status}
              onChange={(e) => set('status', e.target.value as TaskStatus)}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{t.status[option]}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t.taskForm.meeting} htmlFor="task-meeting" hint={t.taskForm.meetingHint}>
          <select
            id="task-meeting"
            value={form.meetingId}
            onChange={(e) => set('meetingId', e.target.value)}
            className={inputClass}
          >
            <option value="">{t.taskForm.noMeeting}</option>
            {meetingOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
};
