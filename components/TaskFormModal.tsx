import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Meeting, Priority, Task, TaskStatus } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { taskAssigneeIds } from '../services/taskAssignees';
import { Select } from './ui/Select';
import { DateTimePicker, parseValue } from './ui/DateTimePicker';

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
  assigneeIds: string[];
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  meetingId: string;
}

const emptyForm = (status: TaskStatus, meetingId: string): FormState => ({
  title: '',
  description: '',
  assigneeIds: [],
  deadline: '',
  priority: 'medium',
  status,
  meetingId,
});

/** Deadlines can arrive from the AI as free text, so only feed real ISO dates to the date picker. */
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
  const [deadlineError, setDeadlineError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setDeadlineError('');
    setForm(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assigneeIds: taskAssigneeIds(task),
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
    // New deadlines cannot be in the past; an existing overdue one may be kept as it is.
    const original = task ? toDateInput(task.deadline) : '';
    const due = parseValue(form.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due && form.deadline !== original && due < today) {
      setDeadlineError(t.taskForm.pastDeadline);
      return;
    }
    onSave({
      id: task?.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: form.description.trim() || undefined,
      assigneeId: form.assigneeIds[0] ?? '',
      assigneeIds: form.assigneeIds,
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
          <Field label={t.taskForm.assignee} htmlFor="task-assignee-list">
            <div id="task-assignee-list" className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1">
              {team.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assigneeIds.includes(u.id)}
                    onChange={() => set(
                      'assigneeIds',
                      form.assigneeIds.includes(u.id)
                        ? form.assigneeIds.filter((id) => id !== u.id)
                        : [...form.assigneeIds, u.id],
                    )}
                    className="h-3.5 w-3.5 accent-blue-600"
                  />
                  <span className="min-w-0 text-sm text-slate-700 truncate">
                    {u.role ? `${u.name} — ${u.role}` : u.name}
                  </span>
                </label>
              ))}
              {team.length === 0 && <p className="px-2 py-1 text-sm italic text-slate-500">{t.common.unassigned}</p>}
            </div>
          </Field>

          <Field label={t.taskForm.deadline} htmlFor="task-deadline" error={deadlineError}>
            <DateTimePicker
              id="task-deadline"
              value={form.deadline}
              onChange={(value) => { set('deadline', value); setDeadlineError(''); }}
              min={new Date()}
              className={inputClass}
            />
          </Field>

          <Field label={t.taskForm.priority} htmlFor="task-priority">
            <Select
              id="task-priority"
              value={form.priority}
              onChange={(priority) => set('priority', priority)}
              options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: t.priority[p] }))}
              className={`${inputClass} capitalize`}
              panelClassName="capitalize"
            />
          </Field>

          <Field label={t.taskForm.status} htmlFor="task-status">
            <Select
              id="task-status"
              value={form.status}
              onChange={(status) => set('status', status)}
              options={STATUS_OPTIONS.map((option) => ({ value: option, label: t.status[option] }))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t.taskForm.meeting} htmlFor="task-meeting" hint={t.taskForm.meetingHint}>
          <Select
            id="task-meeting"
            value={form.meetingId}
            onChange={(meetingId) => set('meetingId', meetingId)}
            options={[{ value: '', label: t.taskForm.noMeeting }, ...meetingOptions.map((m) => ({ value: m.id, label: m.title }))]}
            className={inputClass}
          />
        </Field>
      </form>
    </Modal>
  );
};
