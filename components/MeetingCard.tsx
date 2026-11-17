import React from 'react';
import { Calendar, Clock, Users, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import { Meeting } from '../types';
import { format } from 'date-fns';
import { useI18n } from '../i18n';
import { Avatar } from './ui/Avatar';

interface MeetingCardProps {
  meeting: Meeting;
  onClick: () => void;
  /** Omitted when the signed-in role may not delete meetings. */
  onDelete?: () => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onClick, onDelete }) => {
  const { t, dateLocale } = useI18n();
  const statusStyles: Record<Meeting['status'], string> = {
    completed: 'bg-slate-100 text-slate-600',
    live: 'bg-red-100 text-red-600',
    upcoming: 'bg-green-100 text-green-700',
  };
  const isCompleted = meeting.status === 'completed';

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${statusStyles[meeting.status]}`}>
            {t.meetingStatus[meeting.status]}
          </span>
          {isCompleted && meeting.tasks && meeting.tasks.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <CheckCircle2 className="w-3 h-3" />
              {t.meetings.tasksCount(meeting.tasks.length)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              // The whole card navigates, so the delete button must not bubble.
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label={t.summary.deleteMeetingLabel(meeting.title)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
        {meeting.title}
      </h3>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="w-4 h-4" />
          {format(new Date(meeting.date), 'MMM d, yyyy', { locale: dateLocale })}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock className="w-4 h-4" />
          {format(new Date(meeting.date), 'h:mm a', { locale: dateLocale })} • {meeting.duration}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex -space-x-2">
          {meeting.participants.slice(0, 3).map((p, i) => (
            <Avatar key={i} name={p.name} src={p.avatar} className="w-7 h-7 border-2 border-white" textClassName="text-[9px]" />
          ))}
          {meeting.participants.length > 3 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
              +{meeting.participants.length - 3}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Users className="w-3 h-3" />
          {meeting.participants.length}
        </div>
      </div>
    </div>
  );
};
