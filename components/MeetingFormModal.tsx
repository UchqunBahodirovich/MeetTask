import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Meeting } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';

interface MeetingFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `startNow` tells the app to jump straight into the live meeting view. */
  onSave: (meeting: Meeting, startNow: boolean) => void;
}

/** `datetime-local` needs a local-time string, not the UTC string toISOString() produces. */
const toLocalInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({ open, onClose, onSave }) => {
  const { team } = useTeam();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('30');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [startNow, setStartNow] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDate(toLocalInputValue(new Date()));
    setDuration('30');
    setParticipantIds(team.length ? [team[0].id] : []);
    setStartNow(true);
    setError('');
  }, [open]);

  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t.meetingForm.titleRequired);
      return;
    }
    if (participantIds.length === 0) {
      setError(t.meetingForm.participantsRequired);
      return;
    }
    const parsedDate = date ? new Date(date) : new Date();
    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      title: trimmed,
      date: (Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString(),
      duration: `${duration || '30'} min`,
      participants: team.filter((u) => participantIds.includes(u.id)),
      status: startNow ? 'live' : 'upcoming',
      tasks: [],
    };
    onSave(meeting, startNow);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.meetingForm.title}
      description={t.meetingForm.subtitle}
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
            form="meeting-form"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            {startNow ? t.meetingForm.startMeeting : t.meetingForm.schedule}
          </button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.meetingForm.titleField} htmlFor="meeting-title" error={error}>
          <input
            id="meeting-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.meetingForm.titlePlaceholder}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.meetingForm.dateTime} htmlFor="meeting-date">
            <input
              id="meeting-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t.meetingForm.duration} htmlFor="meeting-duration">
            <input
              id="meeting-duration"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t.meetingForm.participants}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {team.map((user) => {
              const selected = participantIds.includes(user.id);
              return (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => toggleParticipant(user.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50/70 text-slate-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <img src={user.avatar} alt="" className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{user.name}</span>
                    {user.role && <span className="block text-[10px] text-slate-400 truncate">{user.role}</span>}
                  </span>
                  {selected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Field>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm font-medium text-slate-700">
            {t.meetingForm.startNow}
            <span className="block text-xs font-normal text-slate-400">
              {t.meetingForm.startNowHint}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
};
