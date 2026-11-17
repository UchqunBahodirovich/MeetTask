import React, { useMemo, useState } from 'react';
import { Plus, Search, Upload, X } from 'lucide-react';
import { Meeting } from '../types';
import { MeetingCard } from '../components/MeetingCard';
import { useI18n } from '../i18n';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface MeetingsPageProps {
  meetings: Meeting[];
  onMeetingClick: (meeting: Meeting) => void;
  onNewMeeting: () => void;
  onUploadRecording: () => void;
  /** Number of tasks that would go with each meeting, for the warning. */
  taskCountFor: (meetingId: string) => number;
  onDeleteMeeting?: (meeting: Meeting) => Promise<unknown> | void;
}

type StatusFilter = 'all' | Meeting['status'];

const FILTER_IDS: StatusFilter[] = ['all', 'live', 'upcoming', 'completed'];

export const MeetingsPage: React.FC<MeetingsPageProps> = ({ meetings, onMeetingClick, onNewMeeting, onUploadRecording, taskCountFor, onDeleteMeeting }) => {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null);
  const { t } = useI18n();
  const filterLabel = (id: StatusFilter) => (id === 'all' ? t.meetings.all : t.meetingStatus[id]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = { all: meetings.length, live: 0, upcoming: 0, completed: 0 };
    meetings.forEach((m) => {
      base[m.status] += 1;
    });
    return base;
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings
      .filter((m) => (status === 'all' ? true : m.status === status))
      .filter((m) => (q ? m.title.toLowerCase().includes(q) : true))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, status, query]);

  return (
    <>
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.meetings.title}</h1>
          <p className="text-slate-500 mt-1">{t.meetings.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap self-start">
          <button
            type="button"
            onClick={onUploadRecording}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Upload className="w-4 h-4" />
            {t.meetings.uploadRecording}
          </button>
          <button
            type="button"
            onClick={onNewMeeting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            {t.meetings.newMeeting}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {FILTER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              aria-pressed={status === id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap capitalize transition-all ${
                status === id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filterLabel(id)}
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 rounded-full">
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.meetings.searchPlaceholder}
            aria-label={t.meetings.searchLabel}
            className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t.meetings.clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onClick={() => onMeetingClick(m)}
              onDelete={onDeleteMeeting ? () => setPendingDelete(m) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500 font-medium">{t.meetings.noMatches}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('all');
              setQuery('');
            }}
            className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            {t.meetings.resetFilters}
          </button>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.summary.deleteMeetingTitle}
        message={t.summary.deleteMeetingMessage(pendingDelete ? taskCountFor(pendingDelete.id) : 0)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) await onDeleteMeeting?.(target);
        }}
      />
    </>
  );
};
