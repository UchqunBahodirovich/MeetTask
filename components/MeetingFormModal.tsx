import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Meeting } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { Avatar } from './ui/Avatar';
import { isDemoMeeting, resolveDemoTeam } from '../services/demoMeeting';
import { DateTimePicker, ceilToFive, parseValue, toDateTimeValue } from './ui/DateTimePicker';

interface MeetingFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `startNow` tells the app to jump straight into the live meeting view. */
  onSave: (meeting: Meeting, startNow: boolean) => void;
}

/** Default slot for a scheduled meeting: the next 5-minute mark at least 15 minutes out. */
const nextSlot = () => ceilToFive(new Date(Date.now() + 15 * 60_000));
const isPast = (value: string) => {
  const at = parseValue(value);
  return !at || at.getTime() < Date.now();
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
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDate(toDateTimeValue(nextSlot()));
    setDuration('30');
    setParticipantIds(team.length ? [team[0].id] : []);
    setStartNow(true);
    setError('');
    setDateError('');
  }, [open]);

  // A scheduled time that slips into the past while the form is open can only mean "now".
  useEffect(() => {
    if (!open || startNow) return;
    const check = () => {
      if (!isPast(date)) return;
      setStartNow(true);
      setDateError(t.meetingForm.pastTime);
    };
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [open, startNow, date, t]);

  const toggleStartNow = (next: boolean) => {
    setDateError('');
    setStartNow(next);
    // Switching to "schedule" needs a time that has not passed yet.
    if (!next && isPast(date)) setDate(toDateTimeValue(nextSlot()));
  };

  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t.meetingForm.titleRequired);
      return;
    }
    const selectedParticipants = team.filter((u) => participantIds.includes(u.id));
    const demoParticipants = isDemoMeeting(trimmed) ? resolveDemoTeam(team) : [];
    const participants = demoParticipants.length ? demoParticipants : selectedParticipants;
    if (participants.length === 0) {
      setError(t.meetingForm.participantsRequired);
      return;
    }
    if (!startNow && isPast(date)) {
      // Past times cannot be scheduled: offer to start right away instead.
      setStartNow(true);
      setDateError(t.meetingForm.pastTime);
      return;
    }
    const when = startNow ? new Date() : parseValue(date) ?? new Date();
    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      title: trimmed,
      date: when.toISOString(),
      duration: `${duration || '30'} min`,
      participants,
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
          <Field label={t.meetingForm.dateTime} htmlFor="meeting-date" error={dateError}>
            <DateTimePicker
              id="meeting-date"
              withTime
              value={startNow ? '' : date}
              onChange={(value) => { setDate(value); setDateError(''); }}
              min={new Date()}
              disabled={startNow}
              placeholder={startNow ? t.meetingForm.startsNow : undefined}
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
                  <Avatar name={user.name} src={user.avatar} className="w-6 h-6" textClassName="text-[9px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{user.name}</span>
                    {user.role && <span className="block text-[10px] text-slate-500 truncate">{user.role}</span>}
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
            onChange={(e) => toggleStartNow(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm font-medium text-slate-700">
            {t.meetingForm.startNow}
            <span className="block text-xs font-normal text-slate-500">
              {t.meetingForm.startNowHint}
            </span>
          </span>
        </label>

      </form>
    </Modal>
  );
};
